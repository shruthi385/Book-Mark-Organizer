// Google API configuration
const GOOGLE_API_KEY = 'Your_API_Key';
const GOOGLE_CLIENT_ID = 'Your_Client_ID';
const APP_FOLDER_NAME = 'Book Mark Organizer';
const BOOKMARKS_FILE_NAME = 'bookmarks.json';

let bookmarks = [];
let currentView = 'all';
let currentSearchQuery = '';
let googleUser = null;
let gapiInited = false;
let gisInited = false;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Google APIs
    gapiLoaded();
    gisLoaded();

    // DOM Elements
    const bookmarksContainer = document.getElementById('bookmarks-container');
    const addBookmarkForm = document.getElementById('add-bookmark-form');
    const bookmarkForm = document.getElementById('bookmark-form');
    const emptyState = document.getElementById('empty-state');
    const loginPrompt = document.getElementById('login-prompt');
    const viewTitle = document.getElementById('view-title');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const addBookmarkBtn = document.getElementById('add-bookmark');
    const cancelAdd = document.getElementById('cancel-add');
    const bookmarkModal = new bootstrap.Modal(document.getElementById('bookmarkModal'));
    const modalBody = document.getElementById('bookmark-modal-body');
    const modalVisitButton = document.getElementById('modal-visit-button');
    const modalDeleteButton = document.getElementById('modal-delete-button');
    const signoutButton = document.getElementById('signout-button');

    let currentModalBookmarkId = null;

    // Event Listeners
    addBookmarkBtn.addEventListener('click', showAddBookmarkForm);
    cancelAdd.addEventListener('click', hideAddBookmarkForm);
    bookmarkForm.addEventListener('submit', handleFormSubmit);
    searchButton.addEventListener('click', searchBookmarks);
    searchInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') searchBookmarks();
    });
    modalDeleteButton.addEventListener('click', deleteCurrentBookmark);
    signoutButton.addEventListener('click', handleSignout);

    // Initialize Google Sign-In button
    window.handleGoogleSignIn = handleGoogleSignIn;
    window.handleGoogleSignOut = handleGoogleSignOut;

    // Functions
    function handleFormSubmit(e) {
        e.preventDefault();
        addBookmark();
    }

    function showAddBookmarkForm() {
        if (!googleUser) {
            showNotification('Please sign in to add bookmarks', 'warning');
            return;
        }
        viewTitle.textContent = 'Add New Bookmark';
        addBookmarkForm.classList.remove('d-none');
        bookmarkForm.reset();
    }

    function hideAddBookmarkForm() {
        addBookmarkForm.classList.add('d-none');
        viewTitle.textContent = 'All Bookmarks';
    }

    function addBookmark() {
        const title = document.getElementById('bookmark-title').value.trim();
        let url = document.getElementById('bookmark-url').value.trim();
        const tags = document.getElementById('bookmark-tags').value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
        const notes = document.getElementById('bookmark-notes').value.trim();

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        const newBookmark = {
            id: Date.now().toString(),
            title,
            url,
            tags,
            notes,
            createdAt: new Date().toISOString()
        };

        bookmarks.unshift(newBookmark);
        saveBookmarksToDrive();
        hideAddBookmarkForm();
        showNotification('Bookmark added successfully!', 'success');
    }

    function deleteCurrentBookmark() {
        if (!currentModalBookmarkId) return;
        bookmarks = bookmarks.filter(bookmark => bookmark.id !== currentModalBookmarkId);
        saveBookmarksToDrive();
        bookmarkModal.hide();
        showNotification('Bookmark deleted!', 'warning');
    }

    function searchBookmarks() {
        currentSearchQuery = searchInput.value.trim();
        if (currentSearchQuery) {
            currentView = 'search';
            viewTitle.innerHTML = `<i class="fas fa-search me-2"></i> Search results for "${currentSearchQuery}"`;
        } else {
            currentView = 'all';
            viewTitle.textContent = 'All Bookmarks';
        }
        renderBookmarks();
    }

    function renderBookmarks() {
        bookmarksContainer.innerHTML = '';
        emptyState.classList.add('d-none');

        let filteredBookmarks = [...bookmarks];

        if (currentSearchQuery) {
            const query = currentSearchQuery.toLowerCase();
            filteredBookmarks = filteredBookmarks.filter(bookmark => 
                bookmark.title.toLowerCase().includes(query) || 
                (bookmark.notes && bookmark.notes.toLowerCase().includes(query)) ||
                bookmark.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        if (filteredBookmarks.length === 0) {
            emptyState.classList.remove('d-none');
            if (currentSearchQuery) {
                emptyState.querySelector('h3').textContent = 'No matching bookmarks found';
                emptyState.querySelector('p').textContent = 'Try a different search term';
            }
            return;
        }

        filteredBookmarks.forEach((bookmark, index) => {
            const card = document.createElement('div');
            card.className = 'col-md-4 col-lg-3';
            card.innerHTML = `
                <div class="card bookmark-card" style="animation-delay: ${index * 0.05}s">
                    <div class="card-body">
                        <h5 class="card-title">
                            <img src="https://www.google.com/s2/favicons?domain=${extractDomain(bookmark.url)}" class="favicon" alt="Favicon">
                            ${bookmark.title}
                        </h5>
                        <p class="card-text text-muted small">
                            <i class="far fa-calendar-alt"></i> ${formatDate(bookmark.createdAt)}
                        </p>
                        <div class="mb-2">
                            ${bookmark.tags.map(tag => `
                                <span class="badge tag-badge">
                                    <i class="fas fa-tag"></i> ${tag}
                                </span>
                            `).join('')}
                        </div>
                        <button class="btn btn-sm btn-outline-primary view-details" data-id="${bookmark.id}">
                            <i class="fas fa-eye"></i> Details
                        </button>
                    </div>
                </div>
            `;
            bookmarksContainer.appendChild(card);
        });

        // Add event listeners
        document.querySelectorAll('.view-details').forEach(button => {
            button.addEventListener('click', function() {
                const bookmarkId = this.getAttribute('data-id');
                showBookmarkDetails(bookmarkId);
            });
        });

        document.querySelectorAll('.tag-badge').forEach(badge => {
            badge.addEventListener('click', function() {
                const tag = this.textContent.trim();
                filterByTag(tag);
            });
        });
    }

    function showBookmarkDetails(bookmarkId) {
        const bookmark = bookmarks.find(b => b.id === bookmarkId);
        if (!bookmark) return;

        currentModalBookmarkId = bookmarkId;

        modalBody.innerHTML = `
            <div class="d-flex align-items-center mb-3">
                <img src="https://www.google.com/s2/favicons?domain=${extractDomain(bookmark.url)}" class="favicon me-2" alt="Favicon">
                <h5 class="mb-0">${bookmark.title}</h5>
            </div>
            <p class="mb-3">
                <a href="${bookmark.url}" target="_blank">
                    <i class="fas fa-external-link-alt"></i> ${bookmark.url}
                </a>
            </p>
            <div class="mb-3">
                <h6><i class="fas fa-tags"></i> Tags:</h6>
                ${bookmark.tags.map(tag => `<span class="badge bg-primary me-1">${tag}</span>`).join('')}
            </div>
            <p class="text-muted small mb-3">
                <i class="far fa-calendar-alt"></i> Added on ${formatDateTime(bookmark.createdAt)}
            </p>
            <hr>
            <h6><i class="fas fa-file-alt"></i> Notes:</h6>
            <p class="mt-2">${bookmark.notes || '<em class="text-muted">No notes added</em>'}</p>
        `;

        modalVisitButton.href = bookmark.url;
        bookmarkModal.show();
    }

    function filterByTag(tag) {
        currentView = 'tag';
        currentSearchQuery = '';
        searchInput.value = '';
        viewTitle.innerHTML = `<i class="fas fa-tag me-2"></i> Bookmarks tagged with "${tag}"`;
        renderBookmarks();
    }

    // Google API Functions
    function gapiLoaded() {
        gapi.load('client', initializeGapiClient);
    }

    async function initializeGapiClient() {
        await gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        gapiInited = true;
        maybeEnableButtons();
    }

    function gisLoaded() {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSignIn,
        });
        google.accounts.id.renderButton(
            document.getElementById('google-signin-button'),
            { theme: 'outline', size: 'large' }
        );
        google.accounts.id.renderButton(
            document.getElementById('google-signin-button-center'),
            { theme: 'outline', size: 'large', text: 'signin_with' }
        );
        google.accounts.id.prompt();
        gisInited = true;
        maybeEnableButtons();
    }

    function maybeEnableButtons() {
        if (gapiInited && gisInited) {
            document.getElementById('google-signin-button').style.display = 'block';
            document.getElementById('google-signin-button-center').style.display = 'block';
        }
    }

    async function handleGoogleSignIn(response) {
        googleUser = response.credential;
        document.getElementById('signout-button').classList.remove('d-none');
        document.getElementById('login-prompt').classList.add('d-none');
        
        // Load user's bookmarks
        await loadBookmarksFromDrive();
        showNotification('Signed in successfully!', 'success');
    }

    function handleGoogleSignOut() {
        google.accounts.id.disableAutoSelect();
        googleUser = null;
        bookmarks = [];
        document.getElementById('signout-button').classList.add('d-none');
        document.getElementById('login-prompt').classList.remove('d-none');
        renderBookmarks();
    }

    async function handleSignout() {
        handleGoogleSignOut();
        showNotification('Signed out successfully', 'info');
    }

    // Google Drive Functions
    async function loadBookmarksFromDrive() {
        try {
            // Check if app folder exists
            let folderId = await findOrCreateFolder(APP_FOLDER_NAME);
            
            // Check if bookmarks file exists
            const fileId = await findFile(BOOKMARKS_FILE_NAME, folderId);
            
            if (fileId) {
                // Load bookmarks from file
                const response = await gapi.client.drive.files.get({
                    fileId: fileId,
                    alt: 'media'
                });
                bookmarks = response.result.bookmarks || [];
                renderBookmarks();
            } else {
                // Create new empty bookmarks file
                await createBookmarksFile(folderId);
                bookmarks = [];
            }
        } catch (error) {
            console.error('Error loading bookmarks:', error);
            showNotification('Error loading bookmarks', 'error');
        }
    }

    async function saveBookmarksToDrive() {
        if (!googleUser) return;
        
        try {
            // Ensure app folder exists
            const folderId = await findOrCreateFolder(APP_FOLDER_NAME);
            
            // Check if bookmarks file exists
            let fileId = await findFile(BOOKMARKS_FILE_NAME, folderId);
            
            if (fileId) {
                // Update existing file
                await gapi.client.drive.files.update({
                    fileId: fileId,
                    media: {
                        mimeType: 'application/json',
                        body: JSON.stringify({ bookmarks })
                    }
                });
            } else {
                // Create new file
                await createBookmarksFile(folderId);
            }
        } catch (error) {
            console.error('Error saving bookmarks:', error);
            showNotification('Error saving bookmarks', 'error');
        }
    }

    async function findOrCreateFolder(folderName) {
        // Check if folder exists
        const response = await gapi.client.drive.files.list({
            q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id;
        }
        
        // Create new folder
        const createResponse = await gapi.client.drive.files.create({
            resource: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder'
            },
            fields: 'id'
        });
        
        return createResponse.result.id;
    }

    async function findFile(fileName, folderId) {
        const response = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id;
        }
        return null;
    }

    async function createBookmarksFile(folderId) {
        await gapi.client.drive.files.create({
            resource: {
                name: BOOKMARKS_FILE_NAME,
                mimeType: 'application/json',
                parents: [folderId]
            },
            media: {
                mimeType: 'application/json',
                body: JSON.stringify({ bookmarks })
            },
            fields: 'id'
        });
    }

    // Helper functions
    function extractDomain(url) {
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            return domain;
        } catch {
            return url;
        }
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    function formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'exclamation-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
});

// Notification styles
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
.notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.3s ease;
    z-index: 9999;
    max-width: 300px;
}

.notification.show {
    transform: translateY(0);
    opacity: 1;
}

.notification-success {
    background-color: #4BB543;
}

.notification-error {
    background-color: #FF3333;
}

.notification-warning {
    background-color: #FFA500;
}

.notification-info {
    background-color: #4361ee;
}

.notification-content {
    display: flex;
    align-items: center;
}

.notification-content i {
    margin-right: 10px;
    font-size: 1.2rem;
}
`;
document.head.appendChild(notificationStyles);