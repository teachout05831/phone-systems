/**
 * Pipeline Page JavaScript
 *
 * Kanban board with drag-and-drop functionality for sales pipeline management.
 *
 * Features:
 * - Load and render pipeline stages and deals from Supabase
 * - Drag-and-drop deals between stages
 * - Create, update, delete deals
 * - Filter by date, source, priority
 * - Board and list view toggle
 * - Pipeline stats calculation
 */

// ===========================================
// STATE
// ===========================================
const pipelineState = {
  stages: [],
  deals: [],
  filters: {
    dateRange: 'week',
    source: '',
    priority: ''
  },
  currentView: 'board',
  selectedDealId: null,
  draggedDealId: null,
  companyId: null
}

// Stage slug to column ID mapping
const STAGE_COLUMNS = {
  new: 'colNew',
  contacted: 'colContacted',
  qualified: 'colQualified',
  proposal: 'colProposal',
  negotiation: 'colNegotiation',
  won: 'colWon',
  lost: 'colLost'
}

// ===========================================
// INITIALIZATION
// ===========================================

/**
 * Initialize the pipeline page
 */
async function initPipeline() {
  // Restore sidebar state
  const savedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true'
  if (savedCollapsed && window.innerWidth > 1024) {
    document.getElementById('sidebar').classList.add('collapsed')
  }

  // Initialize with auth check
  initPage({
    requireAuth: true,
    onReady: async (user) => {
      // Update user display
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
        document.getElementById('userName').textContent = name
        document.getElementById('userAvatar').textContent = name.charAt(0).toUpperCase()
      }

      // Get company membership
      const { companyId, error } = await getCompanyMembership()
      if (error || !companyId) {
        showError('#boardView', 'Unable to load company data. Please try again.')
        console.error('Company membership error:', error)
        return
      }

      pipelineState.companyId = companyId

      // Load data
      await loadPipelineData()

      // Set up event listeners
      setupEventListeners()
      setupDragAndDrop()
    },
    onError: (error) => {
      console.error('Pipeline init error:', error)
      showError('#boardView', 'Failed to initialize pipeline')
    }
  })
}

// ===========================================
// DATA LOADING
// ===========================================

/**
 * Load all pipeline data (stages and deals)
 */
async function loadPipelineData() {
  try {
    // Show loading state on board
    const board = document.getElementById('boardView')
    if (board) board.classList.add('loading')

    await Promise.all([
      loadStages(),
      loadDeals()
    ])

    // Remove loading state
    if (board) board.classList.remove('loading')

    renderPipelineBoard()
    calculateAndRenderStats()
  } catch (error) {
    console.error('Error loading pipeline data:', error)
    const board = document.getElementById('boardView')
    if (board) board.classList.remove('loading')
    showError('#boardView', 'Failed to load pipeline data')
  }
}

/**
 * Load pipeline stages from Supabase
 */
async function loadStages() {
  // Validation: Check companyId exists
  if (!pipelineState.companyId) {
    console.error('No company ID available')
    return
  }

  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('id, name, slug, color, position, is_closed_won, is_closed_lost')
    .eq('company_id', pipelineState.companyId)
    .order('position', { ascending: true })
    .limit(20)

  if (error) {
    console.error('Error loading stages:', error)
    // Use default stages if none exist
    pipelineState.stages = getDefaultStages()
    return
  }

  // If no stages returned, use defaults
  if (!data || data.length === 0) {
    pipelineState.stages = getDefaultStages()
    return
  }

  pipelineState.stages = data
}

/**
 * Get default pipeline stages
 */
function getDefaultStages() {
  return [
    { id: 'new', name: 'New Lead', slug: 'new', position: 0 },
    { id: 'contacted', name: 'Contacted', slug: 'contacted', position: 1 },
    { id: 'qualified', name: 'Qualified', slug: 'qualified', position: 2 },
    { id: 'proposal', name: 'Proposal', slug: 'proposal', position: 3 },
    { id: 'negotiation', name: 'Negotiation', slug: 'negotiation', position: 4 },
    { id: 'won', name: 'Won', slug: 'won', position: 5, is_closed_won: true },
    { id: 'lost', name: 'Lost', slug: 'lost', position: 6, is_closed_lost: true }
  ]
}

/**
 * Load deals from Supabase with filters applied
 */
async function loadDeals() {
  // Validation: Check companyId exists
  if (!pipelineState.companyId) {
    console.error('No company ID available')
    return
  }

  let query = supabase
    .from('deals')
    .select(`
      id, title, value, priority, source, notes, expected_close_date, created_at,
      stage_id,
      contact:contacts(id, first_name, last_name, phone, email, business_name)
    `)
    .eq('company_id', pipelineState.companyId)
    .order('created_at', { ascending: false })
    .limit(200)

  // Apply filters
  const filters = pipelineState.filters

  // Date range filter
  if (filters.dateRange && filters.dateRange !== 'all') {
    const dateFrom = getDateFromFilter(filters.dateRange)
    if (dateFrom) {
      query = query.gte('created_at', dateFrom.toISOString())
    }
  }

  // Source filter
  if (filters.source) {
    query = query.eq('source', filters.source)
  }

  // Priority filter
  if (filters.priority) {
    query = query.eq('priority', filters.priority)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error loading deals:', error)
    pipelineState.deals = []
    return
  }

  pipelineState.deals = data || []
}

/**
 * Get date from filter value
 */
function getDateFromFilter(filterValue) {
  const now = new Date()
  switch (filterValue) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case 'week':
      const weekAgo = new Date(now)
      weekAgo.setDate(now.getDate() - 7)
      return weekAgo
    case 'month':
      const monthAgo = new Date(now)
      monthAgo.setMonth(now.getMonth() - 1)
      return monthAgo
    case 'quarter':
      const quarterAgo = new Date(now)
      quarterAgo.setMonth(now.getMonth() - 3)
      return quarterAgo
    default:
      return null
  }
}

// ===========================================
// RENDERING
// ===========================================

/**
 * Render the pipeline board with deals in columns
 */
function renderPipelineBoard() {
  // Group deals by stage
  const dealsByStage = {}
  pipelineState.stages.forEach(stage => {
    dealsByStage[stage.slug] = []
  })

  pipelineState.deals.forEach(deal => {
    // Find stage slug by stage_id
    const stage = pipelineState.stages.find(s => s.id === deal.stage_id)
    const stageSlug = stage?.slug || 'new'
    if (dealsByStage[stageSlug]) {
      dealsByStage[stageSlug].push(deal)
    }
  })

  // Render each column
  Object.keys(STAGE_COLUMNS).forEach(stageSlug => {
    const columnId = STAGE_COLUMNS[stageSlug]
    const column = document.getElementById(columnId)
    if (!column) return

    const deals = dealsByStage[stageSlug] || []
    renderColumn(column, deals, stageSlug)
  })

  // Update column counts and values
  updateColumnStats(dealsByStage)
}

/**
 * Render a single column's deals
 */
function renderColumn(column, deals, stageSlug) {
  // Keep the add button if it exists
  const addBtn = column.querySelector('.add-lead-btn')

  if (deals.length === 0) {
    column.innerHTML = ''
    // Add the "Add Lead" button back for non-closed stages
    if (stageSlug !== 'won' && stageSlug !== 'lost') {
      column.innerHTML = `
        <div class="empty-column-state" style="padding: 20px; text-align: center; color: var(--gray-400);">
          No deals in this stage
        </div>
        <button class="add-lead-btn" onclick="openAddLeadModal('${escapeHtml(stageSlug)}')">+ Add Lead</button>
      `
    }
    return
  }

  const dealsHtml = deals.map(deal => renderDealCard(deal)).join('')

  // Add the button for non-closed stages
  const addBtnHtml = (stageSlug !== 'won' && stageSlug !== 'lost')
    ? `<button class="add-lead-btn" onclick="openAddLeadModal('${escapeHtml(stageSlug)}')">+ Add Lead</button>`
    : ''

  column.innerHTML = dealsHtml + addBtnHtml
}

/**
 * Render a single deal card
 */
function renderDealCard(deal) {
  // Validation: Ensure deal has required fields
  if (!deal || !deal.id) return ''

  const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact
  const name = contact
    ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown'
    : deal.title || 'Unknown Lead'
  const company = contact?.business_name || ''
  const phone = contact?.phone ? formatPhone(contact.phone) : ''
  const value = deal.value ? formatCurrency(deal.value) : '$0'
  const priority = deal.priority || 'warm'
  const source = deal.source || 'manual'
  const createdAt = deal.created_at ? timeAgo(deal.created_at) : ''

  return `
    <div class="lead-card ${escapeHtml(priority)}"
         data-deal-id="${escapeHtml(deal.id)}"
         draggable="true"
         onclick="openLeadModal('${escapeHtml(deal.id)}')">
      <div class="lead-card-header">
        <div>
          <div class="lead-card-name">${escapeHtml(name)}</div>
          ${company ? `<div class="lead-card-company">${escapeHtml(company)}</div>` : ''}
        </div>
        <span class="lead-card-priority ${escapeHtml(priority)}">${escapeHtml(capitalize(priority))}</span>
      </div>
      <div class="lead-card-details">
        ${phone ? `<span>📞 ${escapeHtml(phone)}</span>` : ''}
        <span>💰 ${escapeHtml(value)}</span>
      </div>
      <div class="lead-card-footer">
        <span class="lead-card-source ${escapeHtml(source)}">${escapeHtml(capitalize(source))}</span>
        <span class="lead-card-date">${escapeHtml(createdAt)}</span>
      </div>
    </div>
  `
}

/**
 * Update column header stats
 */
function updateColumnStats(dealsByStage) {
  Object.keys(STAGE_COLUMNS).forEach(stageSlug => {
    const deals = dealsByStage[stageSlug] || []
    const count = deals.length
    const value = deals.reduce((sum, d) => sum + (d.value || 0), 0)

    // Update count badge
    const column = document.querySelector(`.pipeline-column.${stageSlug}`)
    if (column) {
      const countEl = column.querySelector('.column-count')
      const valueEl = column.querySelector('.column-value')
      if (countEl) countEl.textContent = count
      if (valueEl) valueEl.textContent = formatCurrency(value)
    }
  })
}

/**
 * Render the list view table
 */
function renderListView() {
  const tbody = document.getElementById('listTableBody')
  if (!tbody) return

  if (pipelineState.deals.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--gray-400);">
          No deals found
        </td>
      </tr>
    `
    return
  }

  tbody.innerHTML = pipelineState.deals.map(deal => {
    const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact
    const name = contact
      ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
      : deal.title || 'Unknown'
    const company = contact?.business_name || '-'
    const phone = contact?.phone ? formatPhone(contact.phone) : '-'
    const stage = pipelineState.stages.find(s => s.id === deal.stage_id)
    const stageSlug = stage?.slug || 'new'
    const stageName = stage?.name || 'New'
    const priority = deal.priority || 'warm'
    const value = deal.value ? formatCurrency(deal.value) : '$0'
    const source = deal.source || 'manual'

    return `
      <tr data-deal-id="${escapeHtml(deal.id)}">
        <td><strong>${escapeHtml(name)}</strong></td>
        <td>${escapeHtml(company)}</td>
        <td>${escapeHtml(phone)}</td>
        <td><span class="stage-badge ${escapeHtml(stageSlug)}"><span class="dot"></span> ${escapeHtml(stageName)}</span></td>
        <td><span class="lead-card-priority ${escapeHtml(priority)}">${escapeHtml(capitalize(priority))}</span></td>
        <td>${escapeHtml(value)}</td>
        <td><span class="lead-card-source ${escapeHtml(source)}">${escapeHtml(capitalize(source))}</span></td>
        <td>
          <button class="btn btn-sm btn-success" onclick="callLead('${escapeHtml(deal.id)}')">📞</button>
          <button class="btn btn-sm btn-secondary" onclick="openLeadModal('${escapeHtml(deal.id)}')">👁️</button>
        </td>
      </tr>
    `
  }).join('')
}

/**
 * Calculate and render pipeline stats
 */
function calculateAndRenderStats() {
  const deals = pipelineState.deals
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(now.getDate() - 7)

  // Total leads
  const totalLeads = deals.length

  // New this week
  const newThisWeek = deals.filter(d => {
    const created = new Date(d.created_at)
    return created >= weekAgo
  }).length

  // Calculate conversion rate (won / total closed)
  const wonDeals = deals.filter(d => {
    const stage = pipelineState.stages.find(s => s.id === d.stage_id)
    return stage?.is_closed_won
  })
  const lostDeals = deals.filter(d => {
    const stage = pipelineState.stages.find(s => s.id === d.stage_id)
    return stage?.is_closed_lost
  })
  const totalClosed = wonDeals.length + lostDeals.length
  const conversionRate = totalClosed > 0
    ? Math.round((wonDeals.length / totalClosed) * 100)
    : 0

  // Pipeline value (excluding won and lost)
  const openDeals = deals.filter(d => {
    const stage = pipelineState.stages.find(s => s.id === d.stage_id)
    return !stage?.is_closed_won && !stage?.is_closed_lost
  })
  const pipelineValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0)

  // Update UI
  document.getElementById('statTotalLeads').textContent = totalLeads
  document.getElementById('statNewLeads').textContent = newThisWeek
  document.getElementById('statConversionRate').textContent = `${conversionRate}%`
  document.getElementById('statPipelineValue').textContent = formatCurrency(pipelineValue)
}

// ===========================================
// DRAG AND DROP
// ===========================================

/**
 * Set up drag and drop functionality
 */
function setupDragAndDrop() {
  // Use event delegation on the board
  const board = document.getElementById('boardView')
  if (!board) return

  // Drag start
  board.addEventListener('dragstart', handleDragStart)

  // Drag end
  board.addEventListener('dragend', handleDragEnd)

  // Set up drop zones on columns
  const columns = board.querySelectorAll('.pipeline-column-body')
  columns.forEach(column => {
    column.addEventListener('dragover', handleDragOver)
    column.addEventListener('dragenter', handleDragEnter)
    column.addEventListener('dragleave', handleDragLeave)
    column.addEventListener('drop', handleDrop)
  })
}

/**
 * Handle drag start
 */
function handleDragStart(e) {
  const card = e.target.closest('.lead-card')
  if (!card) return

  const dealId = card.dataset.dealId
  if (!dealId) return

  pipelineState.draggedDealId = dealId
  e.dataTransfer.setData('text/plain', dealId)
  e.dataTransfer.effectAllowed = 'move'

  // Add dragging class after a short delay for visual feedback
  requestAnimationFrame(() => {
    card.classList.add('dragging')
  })
}

/**
 * Handle drag end
 */
function handleDragEnd(e) {
  const card = e.target.closest('.lead-card')
  if (card) {
    card.classList.remove('dragging')
  }

  // Remove highlight from all columns
  document.querySelectorAll('.pipeline-column-body').forEach(col => {
    col.classList.remove('drag-over')
  })

  pipelineState.draggedDealId = null
}

/**
 * Handle drag over
 */
function handleDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

/**
 * Handle drag enter
 */
function handleDragEnter(e) {
  e.preventDefault()
  const column = e.target.closest('.pipeline-column-body')
  if (column) {
    column.classList.add('drag-over')
  }
}

/**
 * Handle drag leave
 */
function handleDragLeave(e) {
  const column = e.target.closest('.pipeline-column-body')
  // Only remove if actually leaving the column
  if (column && !column.contains(e.relatedTarget)) {
    column.classList.remove('drag-over')
  }
}

/**
 * Handle drop
 */
async function handleDrop(e) {
  e.preventDefault()

  const column = e.target.closest('.pipeline-column-body')
  if (!column) return

  column.classList.remove('drag-over')

  const dealId = e.dataTransfer.getData('text/plain')
  if (!dealId) return

  // Get new stage from column's data-stage attribute (preferred) or ID fallback
  let newStageSlug = column.dataset.stage

  // Fallback: Determine stage slug from column ID
  if (!newStageSlug) {
    for (const [slug, colId] of Object.entries(STAGE_COLUMNS)) {
      if (column.id === colId) {
        newStageSlug = slug
        break
      }
    }
  }

  if (!newStageSlug) return

  // Find the stage ID
  const newStage = pipelineState.stages.find(s => s.slug === newStageSlug)
  if (!newStage) {
    console.error('Stage not found:', newStageSlug)
    return
  }

  // Update deal in database
  await updateDealStage(dealId, newStage.id)
}

/**
 * Update deal stage in database
 */
async function updateDealStage(dealId, newStageId) {
  // Validation: Check required values
  if (!dealId || !newStageId) {
    console.error('Missing dealId or stageId')
    return
  }

  if (!pipelineState.companyId) {
    console.error('No company ID')
    return
  }

  // Validate stage exists
  const stageExists = pipelineState.stages.some(s => s.id === newStageId)
  if (!stageExists) {
    console.error('Invalid stage ID')
    return
  }

  // Optimistic update
  const deal = pipelineState.deals.find(d => d.id === dealId)
  const oldStageId = deal?.stage_id
  if (deal) {
    deal.stage_id = newStageId
    renderPipelineBoard()
    calculateAndRenderStats()
  }

  // Update in database
  const { error } = await supabase
    .from('deals')
    .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .eq('company_id', pipelineState.companyId)

  if (error) {
    console.error('Error updating deal stage:', error)
    // Revert optimistic update
    if (deal && oldStageId) {
      deal.stage_id = oldStageId
      renderPipelineBoard()
      calculateAndRenderStats()
    }
    alert('Failed to update deal stage. Please try again.')
  }
}

// ===========================================
// CRUD OPERATIONS
// ===========================================

/**
 * Create a new deal
 */
async function handleCreateDeal(formData) {
  // Validation: Auth check
  if (!pipelineState.companyId) {
    return { error: 'Not authenticated' }
  }

  // Validation: Required fields
  if (!formData.firstName || typeof formData.firstName !== 'string') {
    return { error: 'First name is required' }
  }
  if (!formData.lastName || typeof formData.lastName !== 'string') {
    return { error: 'Last name is required' }
  }
  if (!formData.phone || typeof formData.phone !== 'string') {
    return { error: 'Phone is required' }
  }

  // Validation: Field lengths
  if (formData.firstName.length < 1 || formData.firstName.length > 100) {
    return { error: 'First name must be 1-100 characters' }
  }
  if (formData.lastName.length < 1 || formData.lastName.length > 100) {
    return { error: 'Last name must be 1-100 characters' }
  }

  // Validation: Phone format (basic check)
  const phoneDigits = formData.phone.replace(/\D/g, '')
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { error: 'Please enter a valid phone number' }
  }

  // Validation: Stage exists
  const stageSlug = formData.stage || 'new'
  const stage = pipelineState.stages.find(s => s.slug === stageSlug)
  if (!stage) {
    return { error: 'Invalid stage' }
  }

  // Validation: Priority is valid
  const validPriorities = ['hot', 'warm', 'cold']
  const priority = formData.priority || 'warm'
  if (!validPriorities.includes(priority)) {
    return { error: 'Invalid priority' }
  }

  // Validation: Value is a number
  const value = parseFloat(formData.value) || 0
  if (value < 0) {
    return { error: 'Value cannot be negative' }
  }

  try {
    // Normalize phone number for comparison (remove non-digits)
    const normalizedPhone = formData.phone.trim().replace(/\D/g, '')

    // First, check if contact with this phone already exists
    const { data: existingContacts, error: searchError } = await supabase
      .from('contacts')
      .select('id, phone')
      .eq('company_id', pipelineState.companyId)
      .limit(100)

    // Find contact with matching phone (normalized comparison)
    let contact = null
    if (!searchError && existingContacts) {
      contact = existingContacts.find(c => {
        const existingNormalized = c.phone?.replace(/\D/g, '') || ''
        return existingNormalized === normalizedPhone ||
               existingNormalized.endsWith(normalizedPhone) ||
               normalizedPhone.endsWith(existingNormalized)
      })
    }

    // If no existing contact found, create a new one
    if (!contact) {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          company_id: pipelineState.companyId,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          phone: formData.phone.trim(),
          email: formData.email?.trim() || null,
          business_name: formData.company?.trim() || null,
          source: formData.source || 'manual'
        })
        .select('id')
        .single()

      if (contactError) {
        console.error('Error creating contact:', contactError)
        return { error: 'Failed to create contact' }
      }
      contact = newContact
    }

    // Create the deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        company_id: pipelineState.companyId,
        contact_id: contact.id,
        stage_id: stage.id,
        title: `${formData.firstName} ${formData.lastName}`.trim(),
        value: value,
        priority: priority,
        source: formData.source || 'manual',
        notes: formData.notes?.trim() || null
      })
      .select()
      .single()

    if (dealError) {
      console.error('Error creating deal:', dealError)
      return { error: 'Failed to create deal' }
    }

    // Validation: Output check
    if (!deal || !deal.id) {
      return { error: 'Deal creation failed' }
    }

    // Refresh deals list
    await loadDeals()
    renderPipelineBoard()
    renderListView()
    calculateAndRenderStats()

    return { success: true, data: deal }
  } catch (err) {
    console.error('Create deal error:', err)
    return { error: 'An unexpected error occurred' }
  }
}

/**
 * Update an existing deal
 */
async function handleUpdateDeal(dealId, formData) {
  // Validation: Auth check
  if (!pipelineState.companyId) {
    return { error: 'Not authenticated' }
  }

  // Validation: Deal ID
  if (!dealId) {
    return { error: 'Deal ID is required' }
  }

  // Validation: Deal exists and belongs to company
  const existingDeal = pipelineState.deals.find(d => d.id === dealId)
  if (!existingDeal) {
    return { error: 'Deal not found' }
  }

  // Build update object with only provided fields
  const updates = {}

  if (formData.stage !== undefined) {
    const stage = pipelineState.stages.find(s => s.slug === formData.stage)
    if (stage) {
      updates.stage_id = stage.id
    }
  }

  if (formData.priority !== undefined) {
    const validPriorities = ['hot', 'warm', 'cold']
    if (validPriorities.includes(formData.priority)) {
      updates.priority = formData.priority
    }
  }

  if (formData.value !== undefined) {
    const value = parseFloat(formData.value)
    if (!isNaN(value) && value >= 0) {
      updates.value = value
    }
  }

  if (formData.notes !== undefined) {
    updates.notes = formData.notes?.trim() || null
  }

  // Only update if there are changes
  if (Object.keys(updates).length === 0) {
    return { success: true }
  }

  updates.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', dealId)
    .eq('company_id', pipelineState.companyId)

  if (error) {
    console.error('Error updating deal:', error)
    return { error: 'Failed to update deal' }
  }

  // Refresh data
  await loadDeals()
  renderPipelineBoard()
  renderListView()
  calculateAndRenderStats()

  return { success: true }
}

/**
 * Delete a deal
 */
async function handleDeleteDeal(dealId) {
  // Validation: Auth check
  if (!pipelineState.companyId) {
    return { error: 'Not authenticated' }
  }

  // Validation: Deal ID
  if (!dealId) {
    return { error: 'Deal ID is required' }
  }

  // Verify deal exists
  const existingDeal = pipelineState.deals.find(d => d.id === dealId)
  if (!existingDeal) {
    return { error: 'Deal not found' }
  }

  const { error } = await supabase
    .from('deals')
    .delete()
    .eq('id', dealId)
    .eq('company_id', pipelineState.companyId)

  if (error) {
    console.error('Error deleting deal:', error)
    return { error: 'Failed to delete deal' }
  }

  // Remove from local state
  pipelineState.deals = pipelineState.deals.filter(d => d.id !== dealId)
  renderPipelineBoard()
  renderListView()
  calculateAndRenderStats()

  return { success: true }
}

// ===========================================
// UI EVENT HANDLERS
// ===========================================

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Filter changes
  document.getElementById('filterDate')?.addEventListener('change', handleFilterChange)
  document.getElementById('filterSource')?.addEventListener('change', handleFilterChange)
  document.getElementById('filterPriority')?.addEventListener('change', handleFilterChange)

  // Stage selector in modal
  document.querySelectorAll('.stage-selector button').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.stage-selector button').forEach(b => b.classList.remove('active'))
      this.classList.add('active')
    })
  })

  // Phone input formatting
  const phoneInput = document.querySelector('#addLeadForm input[name="phone"]')
  if (phoneInput) {
    phoneInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '')
      if (value.length > 0) {
        if (value.length <= 3) {
          value = `(${value}`
        } else if (value.length <= 6) {
          value = `(${value.slice(0, 3)}) ${value.slice(3)}`
        } else {
          value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`
        }
      }
      e.target.value = value
    })
  }
}

/**
 * Handle filter changes
 */
async function handleFilterChange() {
  pipelineState.filters = {
    dateRange: document.getElementById('filterDate')?.value || 'all',
    source: document.getElementById('filterSource')?.value || '',
    priority: document.getElementById('filterPriority')?.value || ''
  }

  await loadDeals()
  renderPipelineBoard()
  renderListView()
  calculateAndRenderStats()
}

/**
 * Toggle between board and list view
 */
function setView(view) {
  pipelineState.currentView = view

  const boardView = document.getElementById('boardView')
  const listView = document.getElementById('listView')
  const boardBtn = document.getElementById('boardViewBtn')
  const listBtn = document.getElementById('listViewBtn')

  if (view === 'board') {
    boardView.style.display = 'flex'
    listView.classList.remove('active')
    boardBtn.classList.add('active')
    listBtn.classList.remove('active')
  } else {
    boardView.style.display = 'none'
    listView.classList.add('active')
    boardBtn.classList.remove('active')
    listBtn.classList.add('active')
    renderListView()
  }
}

/**
 * Open lead detail modal
 */
function openLeadModal(dealId) {
  // Prevent event bubbling from drag
  if (pipelineState.draggedDealId) return

  console.log('Opening lead modal for dealId:', dealId)
  console.log('Available deals:', pipelineState.deals.length)

  pipelineState.selectedDealId = dealId
  const deal = pipelineState.deals.find(d => d.id === dealId)
  if (!deal) {
    console.warn('Deal not found in state:', dealId)
    return
  }

  const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact
  const name = contact
    ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
    : deal.title || 'Unknown'
  const company = contact?.business_name || '-'
  const phone = contact?.phone ? formatPhone(contact.phone) : '-'
  const email = contact?.email || '-'
  const priority = deal.priority || 'warm'
  const source = deal.source || 'manual'
  const value = deal.value ? formatCurrency(deal.value) : '$0'
  const createdAt = deal.created_at ? formatDate(deal.created_at) : '-'
  const notes = deal.notes || ''

  // Find current stage
  const stage = pipelineState.stages.find(s => s.id === deal.stage_id)
  const stageSlug = stage?.slug || 'new'

  // Update modal content
  document.getElementById('leadAvatar').textContent = name.charAt(0).toUpperCase()
  document.getElementById('leadName').textContent = name
  document.getElementById('leadCompany').textContent = company
  document.getElementById('leadPhone').textContent = phone
  document.getElementById('leadEmail').textContent = email
  document.getElementById('leadSource').textContent = capitalize(source)
  document.getElementById('leadValue').textContent = value
  document.getElementById('leadCreated').textContent = createdAt
  document.getElementById('leadLastContact').textContent = '-' // Would need activity log
  document.getElementById('leadNotes').value = notes

  // Update priority badge
  const priorityEl = document.getElementById('leadPriority')
  priorityEl.textContent = capitalize(priority)
  priorityEl.className = `lead-card-priority ${priority}`

  // Update stage selector
  document.querySelectorAll('.stage-selector button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.stage === stageSlug)
  })

  document.getElementById('leadModal').classList.add('active')
}

/**
 * Close lead detail modal
 */
function closeLeadModal() {
  document.getElementById('leadModal').classList.remove('active')
  pipelineState.selectedDealId = null
}

/**
 * Open add lead modal
 */
function openAddLeadModal(stage = 'new') {
  document.getElementById('addLeadModal').classList.add('active')
  document.getElementById('newLeadStage').value = stage
}

/**
 * Close add lead modal
 */
function closeAddLeadModal() {
  document.getElementById('addLeadModal').classList.remove('active')
  document.getElementById('addLeadForm').reset()
}

/**
 * Save new lead
 */
async function saveNewLead() {
  const form = document.getElementById('addLeadForm')
  if (!form.checkValidity()) {
    form.reportValidity()
    return
  }

  const formData = getFormData(form)
  setFormDisabled(form, true)

  const result = await handleCreateDeal(formData)

  setFormDisabled(form, false)

  if (result.error) {
    alert(result.error)
    return
  }

  closeAddLeadModal()
}

/**
 * Save lead changes from modal
 */
async function saveLeadChanges() {
  if (!pipelineState.selectedDealId) return

  // Get stage from active button
  const activeStageBtn = document.querySelector('.stage-selector button.active')
  const stage = activeStageBtn?.dataset.stage

  const notes = document.getElementById('leadNotes').value

  const result = await handleUpdateDeal(pipelineState.selectedDealId, {
    stage,
    notes
  })

  if (result.error) {
    alert(result.error)
    return
  }

  closeLeadModal()
}

/**
 * Delete lead from modal
 */
async function deleteLead() {
  if (!pipelineState.selectedDealId) return

  if (!confirm('Are you sure you want to delete this lead?')) {
    return
  }

  const result = await handleDeleteDeal(pipelineState.selectedDealId)

  if (result.error) {
    alert(result.error)
    return
  }

  closeLeadModal()
}

/**
 * Call lead
 */
function callLead(dealId) {
  const deal = pipelineState.deals.find(d => d.id === (dealId || pipelineState.selectedDealId))
  if (!deal) return

  const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact
  const phone = contact?.phone
  if (phone) {
    window.location.href = `call.html?number=${encodeURIComponent(phone)}`
  }
}

/**
 * Add lead to call queue
 */
async function addToQueue() {
  if (!pipelineState.selectedDealId) return

  const deal = pipelineState.deals.find(d => d.id === pipelineState.selectedDealId)
  if (!deal) return

  const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact
  if (!contact?.id) {
    alert('No contact associated with this lead')
    return
  }

  // Check if already in queue
  const { data: existing } = await supabase
    .from('ai_queue')
    .select('id, status')
    .eq('contact_id', contact.id)
    .in('status', ['pending', 'in_progress', 'retry_scheduled'])
    .maybeSingle()

  if (existing) {
    alert('This contact is already in the queue')
    return
  }

  // Add to AI queue (priority: 1 = high, 2 = normal - only these values allowed)
  const { error } = await supabase
    .from('ai_queue')
    .insert({
      company_id: pipelineState.companyId,
      contact_id: contact.id,
      priority: deal.priority === 'hot' ? 1 : 2,
      status: 'pending'
    })

  if (error) {
    console.error('Error adding to queue:', error)
    alert('Failed to add to queue: ' + error.message)
    return
  }

  alert('Lead added to call queue')
  closeLeadModal()
}

/**
 * Schedule callback for lead
 */
function scheduleCallback() {
  alert('Schedule callback - coming soon')
}

/**
 * Export pipeline data
 */
function exportPipeline() {
  const deals = pipelineState.deals.map(deal => {
    const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact
    const stage = pipelineState.stages.find(s => s.id === deal.stage_id)
    return {
      name: contact ? `${contact.first_name} ${contact.last_name}` : deal.title,
      company: contact?.business_name || '',
      phone: contact?.phone || '',
      email: contact?.email || '',
      stage: stage?.name || 'Unknown',
      priority: deal.priority,
      value: deal.value,
      source: deal.source,
      created: deal.created_at
    }
  })

  // Create CSV with proper escaping
  const headers = ['Name', 'Company', 'Phone', 'Email', 'Stage', 'Priority', 'Value', 'Source', 'Created']
  const rows = deals.map(d => [
    d.name,
    d.company,
    d.phone,
    d.email,
    d.stage,
    d.priority,
    d.value,
    d.source,
    d.created
  ])

  // Escape CSV values to prevent injection and handle special characters
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return ''
    const str = String(val)
    // If contains comma, quote, newline, or starts with =, +, -, @ (formula injection), wrap in quotes and escape
    if (/[,"\n\r]/.test(str) || /^[=+\-@]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const csv = [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n')

  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pipeline-export-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Capitalize first letter
 */
function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// ===========================================
// INITIALIZATION
// ===========================================

// Add CSS for drag and drop and loading states
const dragStyles = document.createElement('style')
dragStyles.textContent = `
  .lead-card.dragging {
    opacity: 0.5;
    transform: rotate(2deg);
  }
  .pipeline-column-body.drag-over {
    background: var(--primary-light);
    outline: 2px dashed var(--primary);
    outline-offset: -2px;
  }
  .empty-column-state {
    font-size: 0.875rem;
    padding: 20px;
    text-align: center;
    color: var(--gray-400);
  }
  .pipeline-board.loading {
    position: relative;
    opacity: 0.6;
    pointer-events: none;
  }
  .pipeline-board.loading::after {
    content: 'Loading...';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    font-weight: 500;
    color: var(--gray-600);
    z-index: 10;
  }
`
document.head.appendChild(dragStyles)

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPipeline)
} else {
  initPipeline()
}
