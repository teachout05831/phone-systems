/**
 * Contacts Import Page JavaScript
 * Handles: CSV upload, parsing, preview, column mapping, batch import
 *
 * Security: Validate all inputs, batch inserts with company_id, limit rows
 */

// ===========================================
// STATE
// ===========================================
let currentStep = 1;
let uploadedFile = null;
let parsedData = [];
let csvHeaders = [];
let columnMapping = {};
let validRows = [];
let invalidRows = [];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 5000;
const BATCH_SIZE = 100;

// Field definitions
const CONTACT_FIELDS = [
  { value: '', label: '-- Skip this column --' },
  { value: 'firstName', label: 'First Name *', required: true },
  { value: 'lastName', label: 'Last Name *', required: true },
  { value: 'fullName', label: 'Full Name' },
  { value: 'phone', label: 'Phone *', required: true },
  { value: 'email', label: 'Email' },
  { value: 'company', label: 'Company' },
  { value: 'title', label: 'Job Title' },
  { value: 'source', label: 'Source' },
  { value: 'notes', label: 'Notes' },
  { value: 'tags', label: 'Tags' }
];

// ===========================================
// INITIALIZATION
// ===========================================
async function initContactsImportPage() {
  initPage({
    requireAuth: true,
    onReady: async (user) => {
      // Update user display
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        document.getElementById('userName').textContent = name;
        document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase();
      }

      // Setup drag and drop
      setupDragAndDrop();

      // Load recent imports
      await loadRecentImports();
    },
    onError: (error) => {
      console.error('Import page init error:', error);
    }
  });
}

// ===========================================
// FILE HANDLING
// ===========================================
function setupDragAndDrop() {
  const uploadZone = document.getElementById('uploadZone');
  if (!uploadZone) return;

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    handleFile(file);
  }
}

async function handleFile(file) {
  // Validate file extension
  const validExtensions = ['.csv', '.xls', '.xlsx'];
  const extension = '.' + file.name.split('.').pop().toLowerCase();

  if (!validExtensions.includes(extension)) {
    alert('Please upload a CSV or Excel file');
    return;
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    alert('File size must be less than 10MB');
    return;
  }

  uploadedFile = file;
  document.getElementById('uploadZone').classList.add('has-file');
  document.getElementById('fileInfo').classList.add('active');
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileMeta').textContent = `${formatFileSize(file.size)} • Analyzing...`;

  try {
    // Parse the file
    if (extension === '.csv') {
      await parseCSV(file);
    } else {
      // For Excel files, we'd need a library like SheetJS
      // For now, show a message
      alert('Excel files require the SheetJS library. Please use CSV format.');
      removeFile();
      return;
    }

    document.getElementById('fileMeta').textContent = `${formatFileSize(file.size)} • ${parsedData.length.toLocaleString()} rows detected`;
    document.getElementById('nextBtn').disabled = false;

  } catch (error) {
    console.error('Error parsing file:', error);
    alert('Failed to parse file. Please check the format.');
    removeFile();
  }
}

async function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const lines = content.split(/\r?\n/).filter(line => line.trim());

        if (lines.length < 2) {
          reject(new Error('File must contain at least a header row and one data row'));
          return;
        }

        // Parse header
        csvHeaders = parseCSVLine(lines[0]);

        // Parse data rows (limit to MAX_ROWS)
        parsedData = [];
        for (let i = 1; i < Math.min(lines.length, MAX_ROWS + 1); i++) {
          const values = parseCSVLine(lines[i]);
          if (values.some(v => v.trim())) {
            const row = {};
            csvHeaders.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            parsedData.push(row);
          }
        }

        if (lines.length > MAX_ROWS + 1) {
          alert(`File contains more than ${MAX_ROWS} rows. Only the first ${MAX_ROWS} will be imported.`);
        }

        // Auto-detect column mapping
        autoDetectMapping();

        resolve();
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function autoDetectMapping() {
  columnMapping = {};

  const mappings = {
    firstName: ['first_name', 'firstname', 'first name', 'fname', 'given name'],
    lastName: ['last_name', 'lastname', 'last name', 'lname', 'surname', 'family name'],
    fullName: ['full_name', 'fullname', 'full name', 'name', 'contact name'],
    phone: ['phone', 'phone_number', 'phonenumber', 'telephone', 'tel', 'mobile', 'cell', 'phone number'],
    email: ['email', 'email_address', 'emailaddress', 'e-mail', 'email address'],
    company: ['company', 'company_name', 'companyname', 'business', 'organization', 'org', 'business name', 'business_name'],
    title: ['title', 'job_title', 'jobtitle', 'position', 'role', 'job title'],
    source: ['source', 'lead_source', 'leadsource', 'origin', 'lead source'],
    notes: ['notes', 'note', 'comments', 'comment', 'description'],
    tags: ['tags', 'tag', 'labels', 'label']
  };

  csvHeaders.forEach((header, index) => {
    const lowerHeader = header.toLowerCase().trim();

    for (const [field, aliases] of Object.entries(mappings)) {
      if (aliases.includes(lowerHeader) && !Object.values(columnMapping).includes(field)) {
        columnMapping[index] = field;
        break;
      }
    }
  });
}

function removeFile() {
  uploadedFile = null;
  parsedData = [];
  csvHeaders = [];
  columnMapping = {};

  document.getElementById('uploadZone').classList.remove('has-file');
  document.getElementById('fileInfo').classList.remove('active');
  document.getElementById('fileInput').value = '';
  document.getElementById('nextBtn').disabled = true;
}

// ===========================================
// STEP NAVIGATION
// ===========================================
function nextStep() {
  if (currentStep < 4) {
    // Validate before proceeding
    if (currentStep === 2 && !validateMapping()) {
      return;
    }

    if (currentStep === 2) {
      validateAndPreview();
    }

    setStep(currentStep + 1);
  }
}

function previousStep() {
  if (currentStep > 1) {
    setStep(currentStep - 1);
  }
}

function setStep(step) {
  currentStep = step;

  // Update step indicators
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById('step' + i);
    stepEl.classList.remove('active', 'completed');
    if (i < step) {
      stepEl.classList.add('completed');
    } else if (i === step) {
      stepEl.classList.add('active');
    }
  }

  // Show/hide sections
  document.getElementById('uploadZone').style.display = step === 1 ? 'block' : 'none';
  document.getElementById('fileInfo').classList.toggle('active', step >= 1 && uploadedFile);
  document.getElementById('mappingSection').classList.toggle('active', step === 2);
  document.getElementById('previewSection').classList.toggle('active', step === 3);
  document.getElementById('importProgress').classList.toggle('active', step === 4);
  document.getElementById('importComplete').classList.remove('active');

  // Show/hide buttons
  document.getElementById('backBtn').style.display = step > 1 && step < 4 ? 'block' : 'none';
  document.getElementById('nextBtn').style.display = step < 4 ? 'block' : 'none';
  document.getElementById('importActions').style.display = step < 4 ? 'flex' : 'none';

  // Update button text
  if (step === 3) {
    document.getElementById('nextBtn').textContent = 'Start Import';
  } else {
    document.getElementById('nextBtn').textContent = 'Continue →';
  }

  // Render step-specific content
  if (step === 2) {
    renderMappingUI();
  } else if (step === 4) {
    startImport();
  }
}

// ===========================================
// COLUMN MAPPING
// ===========================================
function renderMappingUI() {
  const mappingBody = document.querySelector('.mapping-body');
  if (!mappingBody) return;

  mappingBody.innerHTML = csvHeaders.map((header, index) => {
    const selectedValue = columnMapping[index] || '';

    const options = CONTACT_FIELDS.map(field => {
      const selected = field.value === selectedValue ? 'selected' : '';
      return `<option value="${field.value}" ${selected}>${field.label}</option>`;
    }).join('');

    return `
      <div class="mapping-row">
        <div class="csv-column">${escapeHtml(header)}</div>
        <div class="arrow">→</div>
        <select class="input" data-column="${index}" onchange="updateMapping(${index}, this.value)">
          ${options}
        </select>
      </div>
    `;
  }).join('');
}

function updateMapping(columnIndex, fieldValue) {
  if (fieldValue) {
    columnMapping[columnIndex] = fieldValue;
  } else {
    delete columnMapping[columnIndex];
  }
}

function validateMapping() {
  const mappedFields = Object.values(columnMapping);

  // Check for required fields
  const hasFirstName = mappedFields.includes('firstName') || mappedFields.includes('fullName');
  const hasPhone = mappedFields.includes('phone');

  if (!hasFirstName) {
    alert('Please map a column to First Name or Full Name');
    return false;
  }

  if (!hasPhone) {
    alert('Please map a column to Phone');
    return false;
  }

  // Check for duplicate mappings
  const nonEmptyMappings = mappedFields.filter(f => f);
  const uniqueMappings = new Set(nonEmptyMappings);
  if (nonEmptyMappings.length !== uniqueMappings.size) {
    alert('Each field can only be mapped once');
    return false;
  }

  return true;
}

// ===========================================
// PREVIEW
// ===========================================
function validateAndPreview() {
  validRows = [];
  invalidRows = [];

  parsedData.forEach((row, index) => {
    const contact = mapRowToContact(row);
    const validation = validateContact(contact);

    if (validation.valid) {
      validRows.push({ index: index + 1, data: contact });
    } else {
      invalidRows.push({ index: index + 1, data: contact, errors: validation.errors });
    }
  });

  renderPreview();
}

function mapRowToContact(row) {
  const contact = {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    company: '',
    title: '',
    source: 'import',
    notes: '',
    tags: []
  };

  for (const [columnIndex, fieldName] of Object.entries(columnMapping)) {
    const header = csvHeaders[columnIndex];
    const value = row[header] || '';

    if (fieldName === 'fullName' && value) {
      // Split full name into first and last
      const parts = value.trim().split(/\s+/);
      contact.firstName = parts[0] || '';
      contact.lastName = parts.slice(1).join(' ') || '';
    } else if (fieldName === 'tags' && value) {
      // Split tags by comma
      contact.tags = value.split(',').map(t => t.trim()).filter(t => t);
    } else if (fieldName in contact) {
      contact[fieldName] = value.trim();
    }
  }

  return contact;
}

function validateContact(contact) {
  const errors = [];

  // Ralph Wiggum Validation - validate at every step
  if (!contact.firstName && !contact.lastName) {
    errors.push('Name is required');
  }

  if (!contact.phone) {
    errors.push('Phone is required');
  } else {
    // Validate phone format
    const cleanedPhone = contact.phone.replace(/\D/g, '');
    if (cleanedPhone.length < 10 || cleanedPhone.length > 15) {
      errors.push('Invalid phone number');
    }
  }

  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    errors.push('Invalid email format');
  }

  if (contact.firstName && contact.firstName.length > 100) {
    errors.push('First name too long');
  }

  if (contact.lastName && contact.lastName.length > 100) {
    errors.push('Last name too long');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function renderPreview() {
  const previewTotal = document.getElementById('previewTotal');
  const previewTableBody = document.getElementById('previewTableBody');

  if (previewTotal) {
    previewTotal.textContent = parsedData.length.toLocaleString();
  }

  // Show first 10 rows (mix of valid and invalid for demonstration)
  const previewRows = [
    ...validRows.slice(0, 8),
    ...invalidRows.slice(0, 2)
  ].sort((a, b) => a.index - b.index).slice(0, 10);

  previewTableBody.innerHTML = previewRows.map(row => {
    const isValid = !row.errors;
    const statusBadge = isValid
      ? '<span class="badge badge-success">Valid</span>'
      : `<span class="badge badge-danger">${escapeHtml(row.errors[0])}</span>`;

    return `
      <tr class="${isValid ? '' : 'error-row'}">
        <td>${row.index}</td>
        <td class="${!row.data.firstName ? 'error-cell' : ''}">${escapeHtml(row.data.firstName || '')}</td>
        <td>${escapeHtml(row.data.lastName || '')}</td>
        <td class="${row.errors?.some(e => e.includes('phone')) ? 'error-cell' : ''}">${formatPhone(row.data.phone)}</td>
        <td class="${row.errors?.some(e => e.includes('email')) ? 'error-cell' : ''}">${escapeHtml(row.data.email || '')}</td>
        <td>${escapeHtml(row.data.company || '')}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');

  // Update preview count
  const validCount = validRows.length;
  const invalidCount = invalidRows.length;
  const previewHeader = document.querySelector('.preview-header .preview-count');
  if (previewHeader) {
    previewHeader.innerHTML = `
      <span class="badge badge-success" style="margin-right: 8px;">${validCount} valid</span>
      ${invalidCount > 0 ? `<span class="badge badge-danger">${invalidCount} errors</span>` : ''}
    `;
  }
}

// ===========================================
// IMPORT PROCESS
// ===========================================
async function startImport() {
  const progressBar = document.getElementById('progressBar');
  const progressTotal = document.getElementById('progressTotal');
  const progressSuccess = document.getElementById('progressSuccess');
  const progressErrors = document.getElementById('progressErrors');

  const total = validRows.length;
  let imported = 0;
  let errors = invalidRows.length;

  progressTotal.textContent = parsedData.length.toLocaleString();
  progressErrors.textContent = errors;

  if (total === 0) {
    completeImport(0, errors);
    return;
  }

  try {
    // Get company membership
    const { companyId, error: membershipError } = await getCompanyMembership();
    if (membershipError || !companyId) {
      alert('Unable to import. Please try again.');
      resetImport();
      return;
    }

    // Import in batches
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);

      const contacts = batch.map(row => {
        const cleanedPhone = row.data.phone.replace(/\D/g, '');
        const formattedPhone = cleanedPhone.length === 10 ? `+1${cleanedPhone}` : `+${cleanedPhone}`;

        return {
          company_id: companyId,
          first_name: row.data.firstName || null,
          last_name: row.data.lastName || null,
          phone: formattedPhone,
          email: row.data.email || null,
          business_name: row.data.company || null,
          title: row.data.title || null,
          source: row.data.source || 'import',
          notes: row.data.notes || null,
          tags: row.data.tags.length > 0 ? row.data.tags : null,
          status: 'new'
        };
      });

      const { data, error } = await supabase
        .from('contacts')
        .insert(contacts)
        .select('id');

      if (error) {
        console.error('Batch import error:', error);
        errors += batch.length;
      } else {
        imported += data.length;
      }

      // Update progress
      const progress = Math.min(((i + BATCH_SIZE) / validRows.length) * 100, 100);
      progressBar.style.width = progress + '%';
      progressSuccess.textContent = imported.toLocaleString();
      progressErrors.textContent = errors;

      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Log import activity
    await logImportActivity(imported, errors);

    completeImport(imported, errors);

  } catch (error) {
    console.error('Import error:', error);
    alert('Import failed. Please try again.');
    resetImport();
  }
}

async function logImportActivity(successCount, errorCount) {
  try {
    const { companyId } = await getCompanyMembership();
    const { user } = await getCurrentUser();

    if (companyId && user) {
      await supabase.from('import_history').insert({
        company_id: companyId,
        user_id: user.id,
        file_name: uploadedFile?.name || 'unknown',
        total_rows: parsedData.length,
        imported_count: successCount,
        error_count: errorCount,
        status: errorCount === 0 ? 'complete' : 'partial'
      });
    }
  } catch (error) {
    console.error('Error logging import:', error);
  }
}

function completeImport(success, errors) {
  document.getElementById('importProgress').classList.remove('active');
  document.getElementById('importComplete').classList.add('active');

  const successText = success > 0
    ? `Successfully imported ${success.toLocaleString()} contacts`
    : 'No contacts were imported';
  const errorText = errors > 0 ? ` with ${errors} errors` : '';

  document.getElementById('completeText').textContent = successText + errorText;

  // Mark step 4 as completed
  document.getElementById('step4').classList.remove('active');
  document.getElementById('step4').classList.add('completed');
}

function resetImport() {
  currentStep = 1;
  uploadedFile = null;
  parsedData = [];
  csvHeaders = [];
  columnMapping = {};
  validRows = [];
  invalidRows = [];

  // Reset UI
  document.getElementById('uploadZone').classList.remove('has-file');
  document.getElementById('fileInfo').classList.remove('active');
  document.getElementById('fileInput').value = '';
  document.getElementById('nextBtn').disabled = true;
  document.getElementById('importComplete').classList.remove('active');
  document.getElementById('progressBar').style.width = '0%';

  // Reset steps
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById('step' + i);
    stepEl.classList.remove('active', 'completed');
  }
  document.getElementById('step1').classList.add('active');

  setStep(1);
}

// ===========================================
// RECENT IMPORTS
// ===========================================
async function loadRecentImports() {
  try {
    const { companyId } = await getCompanyMembership();
    if (!companyId) return;

    const { data, error } = await supabase
      .from('import_history')
      .select('id, file_name, imported_count, error_count, status, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error loading recent imports:', error);
      return;
    }

    renderRecentImports(data || []);

  } catch (error) {
    console.error('Error loading recent imports:', error);
  }
}

function renderRecentImports(imports) {
  const container = document.querySelector('.recent-imports-list');
  if (!container) return;

  if (imports.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px; text-align: center;">
        <div class="empty-state-text">No recent imports</div>
      </div>
    `;
    return;
  }

  container.innerHTML = imports.map(imp => {
    const statusClass = imp.status === 'complete' ? 'success' : 'partial';
    const statusText = imp.status === 'complete' ? 'Complete' : `${imp.error_count} errors`;

    return `
      <div class="recent-import-item">
        <div class="recent-import-icon">📄</div>
        <div class="recent-import-info">
          <div class="recent-import-name">${escapeHtml(imp.file_name)}</div>
          <div class="recent-import-meta">${formatDate(imp.created_at)} • ${imp.imported_count} contacts</div>
        </div>
        <span class="recent-import-status ${statusClass}">${statusText}</span>
      </div>
    `;
  }).join('');
}

// ===========================================
// TEMPLATE DOWNLOAD
// ===========================================
function downloadTemplate() {
  const headers = ['First Name', 'Last Name', 'Phone', 'Email', 'Company', 'Job Title', 'Source', 'Notes', 'Tags'];
  const sampleRow = ['John', 'Doe', '+15551234567', 'john@example.com', 'Acme Corp', 'Sales Manager', 'Website', 'Sample contact', 'hot,enterprise'];

  const csvContent = [headers, sampleRow]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'contacts_import_template.csv';
  a.click();
  window.URL.revokeObjectURL(url);
}

// ===========================================
// UTILITIES
// ===========================================
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ===========================================
// SIDEBAR (from template)
// ===========================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('mobile-open');
  document.getElementById('sidebarOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebarOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ===========================================
// INITIALIZE
// ===========================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Restore sidebar state
    const savedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (savedCollapsed && window.innerWidth > 1024) {
      document.getElementById('sidebar').classList.add('collapsed');
    }
    initContactsImportPage();
  });
} else {
  const savedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (savedCollapsed && window.innerWidth > 1024) {
    document.getElementById('sidebar').classList.add('collapsed');
  }
  initContactsImportPage();
}
