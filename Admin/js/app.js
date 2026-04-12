// ========================================
// SUPABASE CONFIGURATION
// ========================================
const SUPABASE_URL = 'https://decdwebvdkoejnimioza.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yj3yrvKPMVSI0i742IjzLA_2UCQBfeu';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SHIPS_TABLE = 'ships';
const CERTIFICATES_TABLE = 'ship_certificates';

// ========================================
// GLOBAL STATE
// ========================================
let shipsData = [];
let certificatesData = [];
let selectedShipId = null;
let currentShipId = null;
let certificateTable = null;
let currentFilter = 'all';

// ========================================
// VIEW MANAGEMENT
// ========================================
function showShipListView() {
    document.getElementById('shipListView').classList.remove('hidden');
    document.getElementById('certificateView').classList.add('hidden');
    currentShipId = null;
}

function showCertificateView(shipId) {
    const ship = shipsData.find(s => s.id === shipId);
    if (!ship) return;
    
    currentShipId = shipId;
    document.getElementById('currentShipName').textContent = ship.ship_name;
    document.getElementById('currentShipRegion').textContent = `📍 ${ship.region}`;
    document.getElementById('certShipId').value = shipId;
    
    document.getElementById('shipListView').classList.add('hidden');
    document.getElementById('certificateView').classList.remove('hidden');
    
    // Reset search and filters
    document.getElementById('certSearchInput').value = '';
    document.getElementById('clearCertSearchBtn').classList.remove('visible');
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-filter') === 'all') btn.classList.add('active');
    });
    currentFilter = 'all';
    
    initializeCertificateTable();
    loadCertificatesForShip(shipId);
}

document.getElementById('backToShipsBtn').addEventListener('click', showShipListView);

// ========================================
// SELECTION MANAGEMENT WITH DESELECTION
// ========================================
function selectShip(shipId) {
    // Check if clicking the same ship (deselect)
    if (selectedShipId === shipId) {
        deselectShip();
        return;
    }
    
    // Deselect all
    document.querySelectorAll('.ship-box').forEach(box => {
        box.classList.remove('selected');
    });
    
    // Select clicked ship
    const clickedBox = document.querySelector(`.ship-box[data-ship-id="${shipId}"]`);
    if (clickedBox) {
        clickedBox.classList.add('selected');
        selectedShipId = shipId;
        
        // Enable toolbar buttons
        document.getElementById('editShipBtn').disabled = false;
        document.getElementById('editShipBtn').classList.remove('disabled');
        document.getElementById('deleteShipBtn').disabled = false;
        document.getElementById('deleteShipBtn').classList.remove('disabled');
        document.getElementById('viewCertsBtn').disabled = false;
        document.getElementById('viewCertsBtn').classList.remove('disabled');
    }
}

function deselectShip() {
    document.querySelectorAll('.ship-box').forEach(box => {
        box.classList.remove('selected');
    });
    selectedShipId = null;
    
    // Disable toolbar buttons
    document.getElementById('editShipBtn').disabled = true;
    document.getElementById('editShipBtn').classList.add('disabled');
    document.getElementById('deleteShipBtn').disabled = true;
    document.getElementById('deleteShipBtn').classList.add('disabled');
    document.getElementById('viewCertsBtn').disabled = true;
    document.getElementById('viewCertsBtn').classList.add('disabled');
}

// ========================================
// TOOLBAR ACTIONS
// ========================================
document.getElementById('editShipBtn').addEventListener('click', function() {
    if (selectedShipId) {
        const ship = shipsData.find(s => s.id === selectedShipId);
        if (ship) {
            document.getElementById('shipModalTitle').textContent = 'Edit Ship';
            document.getElementById('shipEditId').value = ship.id;
            document.getElementById('shipName').value = ship.ship_name;
            document.getElementById('shipRegion').value = ship.region;
            document.getElementById('shipModalOverlay').classList.add('active');
        }
    }
});

document.getElementById('deleteShipBtn').addEventListener('click', async function() {
    if (selectedShipId) {
        const ship = shipsData.find(s => s.id === selectedShipId);
        if (ship && confirm(`Delete "${ship.ship_name}" and all its certificates?`)) {
            showLoading();
            await deleteShip(selectedShipId);
            deselectShip();
            await renderShips();
        }
    }
});

document.getElementById('viewCertsBtn').addEventListener('click', function() {
    if (selectedShipId) {
        showCertificateView(selectedShipId);
    }
});

// ========================================
// LOADING INDICATOR
// ========================================
function showLoading() {
    const loader = document.createElement('div');
    loader.className = 'loading-overlay';
    loader.innerHTML = '<div class="loading-spinner"></div>';
    const wrapper = document.querySelector('.content-wrapper');
    if (wrapper && !document.querySelector('.loading-overlay')) {
        wrapper.appendChild(loader);
    }
}

function hideLoading() {
    const loader = document.querySelector('.loading-overlay');
    if (loader) loader.remove();
}

// ========================================
// DATABASE OPERATIONS
// ========================================
async function loadShips() {
    try {
        const { data, error } = await supabaseClient
            .from(SHIPS_TABLE)
            .select('*')
            .order('ship_name', { ascending: true });
        
        if (error) throw error;
        shipsData = data || [];
        return shipsData;
    } catch (error) {
        console.error('Error loading ships:', error);
        return [];
    }
}

async function loadCertificatesCount() {
    try {
        const { data, error } = await supabaseClient
            .from(CERTIFICATES_TABLE)
            .select('ship_id, id');
        
        if (error) throw error;
        
        const counts = {};
        (data || []).forEach(cert => {
            counts[cert.ship_id] = (counts[cert.ship_id] || 0) + 1;
        });
        
        return counts;
    } catch (error) {
        console.error('Error loading certificate counts:', error);
        return {};
    }
}

async function loadCertificatesForShip(shipId) {
    showLoading();
    try {
        const { data, error } = await supabaseClient
            .from(CERTIFICATES_TABLE)
            .select('*')
            .eq('ship_id', shipId)
            .order('certification', { ascending: true });
        
        if (error) throw error;
        certificatesData = data || [];
        
        if (certificateTable) {
            certificateTable.setData(certificatesData);
            applyFilter(currentFilter);
        }
        
        hideLoading();
        return certificatesData;
    } catch (error) {
        console.error('Error loading certificates:', error);
        hideLoading();
        return [];
    }
}

async function saveShip(ship) {
    try {
        const { data, error } = await supabaseClient
            .from(SHIPS_TABLE)
            .insert([ship])
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('Error saving ship:', error);
        throw error;
    }
}

async function updateShip(id, ship) {
    try {
        const { data, error } = await supabaseClient
            .from(SHIPS_TABLE)
            .update(ship)
            .eq('id', id)
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('Error updating ship:', error);
        throw error;
    }
}

async function deleteShip(id) {
    try {
        const { error } = await supabaseClient
            .from(SHIPS_TABLE)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting ship:', error);
        throw error;
    }
}

async function saveCertificate(certificate) {
    try {
        const { data, error } = await supabaseClient
            .from(CERTIFICATES_TABLE)
            .insert([certificate])
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('Error saving certificate:', error);
        throw error;
    }
}

async function updateCertificate(id, certificate) {
    try {
        const { data, error } = await supabaseClient
            .from(CERTIFICATES_TABLE)
            .update(certificate)
            .eq('id', id)
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('Error updating certificate:', error);
        throw error;
    }
}

async function deleteCertificate(id) {
    try {
        const { error } = await supabaseClient
            .from(CERTIFICATES_TABLE)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting certificate:', error);
        throw error;
    }
}

// ========================================
// SHIP LIST RENDERING
// ========================================
async function renderShips() {
    showLoading();
    await loadShips();
    const certCounts = await loadCertificatesCount();
    
    const grid = document.getElementById('shipsGrid');
    grid.innerHTML = '';
    
    if (shipsData.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                    <path d="M12 62L50 45L88 62L82 80H18L12 62Z" stroke="currentColor" stroke-width="4"/>
                    <path d="M30 45L50 32L70 45" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                </svg>
                <h3>No Ships Added Yet</h3>
                <p>Click "Add Ship" to get started</p>
            </div>
        `;
    } else {
        shipsData.forEach(ship => {
            const count = certCounts[ship.id] || 0;
            const box = createShipBox(ship, count);
            grid.appendChild(box);
        });
    }
    
    hideLoading();
}

function createShipBox(ship, certCount) {
    const box = document.createElement('div');
    box.className = 'ship-box';
    box.setAttribute('data-ship-id', ship.id);
    
    box.addEventListener('click', function() {
        selectShip(ship.id);
    });
    
    box.innerHTML = `
        <div class="ship-box-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path d="M6 28L24 20L42 28L40 38H8L6 28Z" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="3"/>
                <path d="M15 20L24 15L33 20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                <line x1="24" y1="15" x2="24" y2="6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                <path d="M24 6L28 8L24 10L20 8L24 6Z" fill="currentColor"/>
            </svg>
        </div>
        <div class="ship-box-info">
            <h3 class="ship-box-name">${ship.ship_name}</h3>
            <p class="ship-box-region">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M7 1.5V12.5M1.5 7H12.5" stroke="currentColor" stroke-width="1.5"/>
                </svg>
                ${ship.region}
            </p>
        </div>
        <div class="ship-box-count">
            <div class="count-circle">
                <span class="count-num">${certCount}</span>
            </div>
            <span class="count-text">Certificate${certCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="selection-indicator">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5"/>
                <path d="M8 12L11 15L16 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
    `;
    
    return box;
}

// ========================================
// SHIP SEARCH WITH NO RESULTS MESSAGE
// ========================================
const shipSearchInput = document.getElementById('shipSearchInput');
const clearShipSearchBtn = document.getElementById('clearShipSearchBtn');

shipSearchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    const boxes = document.querySelectorAll('.ship-box');
    let visibleCount = 0;
    
    boxes.forEach(box => {
        const name = box.querySelector('.ship-box-name').textContent.toLowerCase();
        const region = box.querySelector('.ship-box-region').textContent.toLowerCase();
        
        if (name.includes(query) || region.includes(query)) {
            box.style.display = 'flex';
            visibleCount++;
        } else {
            box.style.display = 'none';
        }
    });
    
    clearShipSearchBtn.classList.toggle('visible', query.length > 0);
    
    // Show/hide no results message
    const grid = document.getElementById('shipsGrid');
    let noResultsMsg = grid.querySelector('.no-results-message');
    
    if (visibleCount === 0 && query.length > 0 && boxes.length > 0) {
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.className = 'no-results-message';
            noResultsMsg.innerHTML = `
                <div class="no-results-content">
                    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                        <circle cx="35" cy="35" r="20" stroke="currentColor" stroke-width="4"/>
                        <path d="M50 50L70 70" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                        <line x1="28" y1="35" x2="42" y2="35" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                    </svg>
                    <h3>No Ships Found</h3>
                    <p>No ships match your search "<strong>${query}</strong>"</p>
                </div>
            `;
            grid.appendChild(noResultsMsg);
        } else {
            noResultsMsg.querySelector('strong').textContent = query;
        }
    } else if (noResultsMsg) {
        noResultsMsg.remove();
    }
});

clearShipSearchBtn.addEventListener('click', function() {
    shipSearchInput.value = '';
    document.querySelectorAll('.ship-box').forEach(box => {
        box.style.display = 'flex';
    });
    const noResultsMsg = document.querySelector('.no-results-message');
    if (noResultsMsg) noResultsMsg.remove();
    this.classList.remove('visible');
});

// ========================================
// CERTIFICATE TABLE WITH BETTER SIZING
// ========================================
function initializeCertificateTable() {
    if (certificateTable) {
        certificateTable.destroy();
    }
    
    certificateTable = new Tabulator("#certificatesTable", {
        data: certificatesData,
        layout: "fitData",
        pagination: "local",
        paginationSize: 20,
        paginationSizeSelector: [10, 20, 50, 100],
        responsiveLayout: "collapse",
        placeholder: "No certificates found",
        columns: [
            {
                title: "Certification Name",
                field: "certification",
                minWidth: 300,
                widthGrow: 3,
                sorter: "string",
                headerSort: true
            },
            {
                title: "Certificate Number",
                field: "number",
                minWidth: 180,
                widthGrow: 2,
                sorter: "string"
            },
            {
                title: "Issuer",
                field: "issuer",
                minWidth: 200,
                widthGrow: 2,
                sorter: "string"
            },
            {
                title: "Date Issued",
                field: "date_issue",
                minWidth: 150,
                widthGrow: 1,
                sorter: "date",
                formatter: function(cell) {
                    const date = new Date(cell.getValue());
                    return date.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                }
            },
            {
                title: "Date Expires",
                field: "date_expire",
                minWidth: 150,
                widthGrow: 1,
                sorter: "date",
                formatter: function(cell) {
                    const value = cell.getValue();
                    if (!value) return '<span class="na-text">N/A</span>';
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                }
            },
            {
                title: "Status",
                field: "date_expire",
                minWidth: 150,
                widthGrow: 1,
                hozAlign: "center",
                headerHozAlign: "center",
                formatter: function(cell) {
                    const data = cell.getRow().getData();
                    
                    if (data.for_renewal) {
                        return '<span class="status-badge status-renewal">For Renewal</span>';
                    }
                    
                    if (!data.date_expire) {
                        return '<span class="status-badge status-na">N/A</span>';
                    }
                    
                    const expireDate = new Date(data.date_expire);
                    const today = new Date();
                    const days = Math.floor((expireDate - today) / (1000 * 60 * 60 * 24));
                    
                    if (days < 0) {
                        return '<span class="status-badge status-expired">Expired</span>';
                    } else if (days <= 30) {
                        return '<span class="status-badge status-expiring">Expiring Soon</span>';
                    } else {
                        return '<span class="status-badge status-active">Active</span>';
                    }
                }
            },
            {
                title: "Remarks",
                field: "remarks",
                minWidth: 220,
                widthGrow: 2,
                formatter: function(cell) {
                    const value = cell.getValue();
                    return value || '<span class="na-text">-</span>';
                }
            },
            {
                title: "Actions",
                field: "actions",
                width: 130,
                hozAlign: "center",
                headerHozAlign: "center",
                headerSort: false,
                formatter: function(cell) {
                    const id = cell.getRow().getData().id;
                    return `
                        <div class="action-buttons">
                            <button class="action-btn edit" onclick="editCertificate(${id})" title="Edit">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                    <path d="M12 2L16 6M2 16L6 15.5L16 5.5L12 1.5L2 11.5L2 16Z" stroke="currentColor" stroke-width="1.5"/>
                                </svg>
                            </button>
                            <button class="action-btn delete" onclick="deleteCertificateConfirm(${id})" title="Delete">
                                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                    <path d="M3 5H15M6 5V3H12V5M7 8V13M11 8V13M5 5L6 15H12L13 5" stroke="currentColor" stroke-width="1.5"/>
                                </svg>
                            </button>
                        </div>
                    `;
                }
            }
        ]
    });
}

// ========================================
// EXCEL EXPORT
// ========================================
function exportToExcel() {
    if (!currentShipId) return;
    
    const ship = shipsData.find(s => s.id === currentShipId);
    if (!ship) return;
    
    // Get filtered data from table
    const data = certificateTable.getData();
    
    if (data.length === 0) {
        alert('No certificates to export');
        return;
    }
    
    // Prepare export data with ship info header
    const exportData = [
        ['SHIP NAME:', ship.ship_name],
        ['REGION:', ship.region],
        [''],
        ['Certification Name', 'Certificate Number', 'Issuer', 'Date Issued', 'Date Expires', 'Status', 'Remarks']
    ];
    
    // Add certificate rows
    data.forEach(cert => {
        let status = 'N/A';
        if (cert.for_renewal) {
            status = 'For Renewal';
        } else if (cert.date_expire) {
            const expireDate = new Date(cert.date_expire);
            const today = new Date();
            const days = Math.floor((expireDate - today) / (1000 * 60 * 60 * 24));
            
            if (days < 0) status = 'Expired';
            else if (days <= 30) status = 'Expiring Soon';
            else status = 'Active';
        }
        
        exportData.push([
            cert.certification,
            cert.number,
            cert.issuer,
            cert.date_issue ? new Date(cert.date_issue).toLocaleDateString() : '',
            cert.date_expire ? new Date(cert.date_expire).toLocaleDateString() : 'N/A',
            status,
            cert.remarks || '-'
        ]);
    });
    
    // Create CSV content
    const csvContent = exportData.map(row => 
        row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const filename = `${ship.ship_name.replace(/[^a-z0-9]/gi, '_')}_Certificates_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Add export button to certificate view
document.addEventListener('DOMContentLoaded', function() {
    const addCertBtn = document.getElementById('addCertBtn');
    if (addCertBtn) {
        const exportBtn = document.createElement('button');
        exportBtn.className = 'toolbar-btn export-btn';
        exportBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M17 13V17H3V13M10 3V13M10 13L6 9M10 13L14 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Export to Excel
        `;
        exportBtn.addEventListener('click', exportToExcel);
        addCertBtn.parentNode.insertBefore(exportBtn, addCertBtn);
    }
});

// ========================================
// CERTIFICATE SEARCH & FILTERS
// ========================================
const certSearchInput = document.getElementById('certSearchInput');
const clearCertSearchBtn = document.getElementById('clearCertSearchBtn');

certSearchInput.addEventListener('input', function() {
    const value = this.value;
    certificateTable.setFilter([
        [
            {field: "certification", type: "like", value: value},
            {field: "number", type: "like", value: value},
            {field: "issuer", type: "like", value: value},
        ]
    ]);
    
    clearCertSearchBtn.classList.toggle('visible', value.length > 0);
});

clearCertSearchBtn.addEventListener('click', function() {
    certSearchInput.value = '';
    certificateTable.clearFilter();
    this.classList.remove('visible');
    applyFilter(currentFilter);
});

const filterButtons = document.querySelectorAll('.filter-btn');

filterButtons.forEach(btn => {
    btn.addEventListener('click', function() {
        filterButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        const filter = this.getAttribute('data-filter');
        currentFilter = filter;
        applyFilter(filter);
    });
});

function applyFilter(filter) {
    if (filter === 'all') {
        certificateTable.clearFilter();
    } else if (filter === 'renewal') {
        certificateTable.setFilter("for_renewal", "=", true);
    } else {
        certificateTable.setFilter(function(data) {
            if (data.for_renewal) return false;
            if (!data.date_expire) return false;
            
            const expireDate = new Date(data.date_expire);
            const today = new Date();
            const days = Math.floor((expireDate - today) / (1000 * 60 * 60 * 24));
            
            if (filter === 'active') return days > 30;
            if (filter === 'expiring') return days > 0 && days <= 30;
            if (filter === 'expired') return days < 0;
            
            return true;
        });
    }
}

// ========================================
// MODALS
// ========================================
const shipModal = document.getElementById('shipModalOverlay');
const shipForm = document.getElementById('shipForm');

document.getElementById('addShipBtn').addEventListener('click', () => {
    document.getElementById('shipModalTitle').textContent = 'Add New Ship';
    shipForm.reset();
    document.getElementById('shipEditId').value = '';
    shipModal.classList.add('active');
});

document.getElementById('shipModalCloseBtn').addEventListener('click', () => {
    shipModal.classList.remove('active');
});

document.getElementById('shipCancelBtn').addEventListener('click', () => {
    shipModal.classList.remove('active');
});

shipModal.addEventListener('click', (e) => {
    if (e.target === shipModal) shipModal.classList.remove('active');
});

shipForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const editId = document.getElementById('shipEditId').value;
    const shipData = {
        ship_name: document.getElementById('shipName').value,
        region: document.getElementById('shipRegion').value
    };
    
    showLoading();
    
    if (editId) {
        await updateShip(editId, shipData);
    } else {
        await saveShip(shipData);
    }
    
    shipModal.classList.remove('active');
    deselectShip();
    await renderShips();
});

const certModal = document.getElementById('certModalOverlay');
const certForm = document.getElementById('certificateForm');

document.getElementById('addCertBtn').addEventListener('click', () => {
    document.getElementById('certModalTitle').textContent = 'Add New Certificate';
    certForm.reset();
    document.getElementById('certEditId').value = '';
    document.getElementById('certShipId').value = currentShipId;
    certModal.classList.add('active');
});

document.getElementById('certModalCloseBtn').addEventListener('click', () => {
    certModal.classList.remove('active');
});

document.getElementById('certCancelBtn').addEventListener('click', () => {
    certModal.classList.remove('active');
});

certModal.addEventListener('click', (e) => {
    if (e.target === certModal) certModal.classList.remove('active');
});

certForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const editId = document.getElementById('certEditId').value;
    const dateExpire = document.getElementById('dateExpire').value;
    
    const certData = {
        ship_id: document.getElementById('certShipId').value,
        certification: document.getElementById('certificationName').value,
        number: document.getElementById('certificationNumber').value,
        issuer: document.getElementById('certificateIssuer').value,
        date_issue: document.getElementById('dateIssue').value,
        date_expire: dateExpire || null,
        remarks: document.getElementById('remarks').value,
        for_renewal: document.getElementById('forRenewal').checked
    };
    
    showLoading();
    
    if (editId) {
        await updateCertificate(editId, certData);
    } else {
        await saveCertificate(certData);
    }
    
    certModal.classList.remove('active');
    await loadCertificatesForShip(currentShipId);
});

window.editCertificate = function(id) {
    const cert = certificatesData.find(c => c.id === id);
    if (cert) {
        document.getElementById('certModalTitle').textContent = 'Edit Certificate';
        document.getElementById('certEditId').value = cert.id;
        document.getElementById('certShipId').value = cert.ship_id;
        document.getElementById('certificationName').value = cert.certification;
        document.getElementById('certificationNumber').value = cert.number;
        document.getElementById('certificateIssuer').value = cert.issuer;
        document.getElementById('dateIssue').value = cert.date_issue;
        document.getElementById('dateExpire').value = cert.date_expire || '';
        document.getElementById('remarks').value = cert.remarks || '';
        document.getElementById('forRenewal').checked = cert.for_renewal || false;
        certModal.classList.add('active');
    }
};

window.deleteCertificateConfirm = async function(id) {
    if (confirm('Delete this certificate?')) {
        showLoading();
        await deleteCertificate(id);
        await loadCertificatesForShip(currentShipId);
    }
};

// ========================================
// INITIALIZE
// ========================================
document.addEventListener('DOMContentLoaded', async function() {
    await renderShips();
});