import { useState, useEffect, useCallback } from 'react';
import { marked } from 'marked'; // For Markdown parsing
import './App.css';
import EditModal from './EditModal'; // Import the edit modal
import AddDocumentModal from './AddDocumentModal'; // Import the add document modal

// --- Helper function for IDs ---
let nextId = 4;
function generateId() {
    return (nextId++).toString();
}

// --- Initial Data Structure (Updated to use filePath) ---
const initialData = [
    { id: '1', name: 'Introduction', type: 'document', filePath: '/documents/introduction.md', children: [] },
    { id: '2', name: 'EC2 Instances', type: 'category', children: [
        { id: '2.1', name: 'Overview', type: 'document', filePath: '/documents/ec2-overview.html', children: [] },
        { id: '2.2', name: 'Getting Started', type: 'document', filePath: '/documents/getting-started-ec2.md', children: [] }
    ]},
    { id: '3', name: 'S3 Buckets', type: 'document', filePath: '/documents/s3-storage.html', children: [] },
    { id: 'new_doc', name: 'My New Doc (Inline)', type: 'document', content: '<h1>Inline Content</h1><p>This content is directly in the data.</p>', lastUpdated: new Date().toLocaleDateString(), children: [] }
];


// --- Recursive CategoryItem Component ---
function CategoryItem({ item, level, onSelectItem, onShowContextMenu, activeItemId }) {
    const [isExpanded, setIsExpanded] = useState(true);

    const handleToggleExpand = (e) => {
        e.stopPropagation();
        if (item.type === 'category') {
            setIsExpanded(!isExpanded);
        }
    };

    const itemStyle = {
        paddingLeft: `${5 + level * 20}px`,
    };

    return (
        <>
            <li
                data-id={item.id}
                style={itemStyle}
                className={item.id === activeItemId ? 'active' : ''}
            >
                <span className="item-name" onClick={() => onSelectItem(item.id)}>
                    {item.type === 'category' && (
                        <span onClick={handleToggleExpand} style={{ cursor: 'pointer', marginRight: '5px' }}>
                            {isExpanded ? '▼' : '►'}
                        </span>
                    )}
                    {item.type === 'category' ? '📁' : '📄'} {item.name}
                </span>
                <button
                    className="options-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onShowContextMenu(e, item.id, item.type);
                    }}
                >
                    ⋮
                </button>
            </li>
            {item.type === 'category' && isExpanded && item.children && item.children.length > 0 && (
                <ul style={{ padding: 0, margin: 0 }}>
                    {item.children.sort((a,b) => a.name.localeCompare(b.name)).map(child => (
                        <CategoryItem
                            key={child.id}
                            item={child}
                            level={level + 1}
                            onSelectItem={onSelectItem}
                            onShowContextMenu={onShowContextMenu}
                            activeItemId={activeItemId}
                        />
                    ))}
                </ul>
            )}
        </>
    );
}


// --- Main App Component ---
function App() { // <<<< THIS IS THE SINGLE, CORRECT App FUNCTION DEFINITION
    const [data, setData] = useState(initialData);
    const [activeItemId, setActiveItemId] = useState(null);
    const [activeDocumentContent, setActiveDocumentContent] = useState('');
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingDocument, setEditingDocument] = useState(null);
    const [isAddDocumentModalOpen, setIsAddDocumentModalOpen] = useState(false);
    const [addDocumentParentInfo, setAddDocumentParentInfo] = useState({ id: null, name: '' });

    const [contextMenu, setContextMenu] = useState({
        visible: false, x: 0, y: 0, targetId: null, itemType: null,
    });

    const selectedItem = activeItemId ? findItemById(data, activeItemId) : null;

    // --- Utility Functions ---
    function findItemById(items, id) {
        for (const item of items) {
            if (item.id === id) return item;
            if (item.children && item.children.length > 0) {
                const foundInChildren = findItemById(item.children, id);
                if (foundInChildren) return foundInChildren;
            }
        }
        return null;
    }

    const deepCloneAndUpdate = (items, targetId, updateFn) => {
        return items.map(item => {
            if (item.id === targetId) {
                return updateFn(item);
            }
            if (item.children) {
                return { ...item, children: deepCloneAndUpdate(item.children, targetId, updateFn) };
            }
            return item;
        });
    };

    const deepCloneAndRemove = (items, targetId) => {
        return items.filter(item => {
            if (item.id === targetId) return false;
            if (item.children) {
                item.children = deepCloneAndRemove(item.children, targetId);
            }
            return true;
        });
    };

    const deepCloneAndAddChild = (items, parentId, newItem) => {
         return items.map(item => {
            if (item.id === parentId) {
                if (item.type === 'category') {
                    return { ...item, children: [...(item.children || []), newItem].sort((a,b) => a.name.localeCompare(b.name)) };
                }
                return item;
            }
            if (item.children) {
                return { ...item, children: deepCloneAndAddChild(item.children, parentId, newItem) };
            }
            return item;
        });
    };

    // --- Content Fetching and Handling ---
    useEffect(() => {
        if (selectedItem && selectedItem.type === 'document') {
            setIsLoadingContent(true);
            setActiveDocumentContent('');

            if (selectedItem.content) {
                setActiveDocumentContent(selectedItem.content);
                setIsLoadingContent(false);
            } else if (selectedItem.filePath) {
                fetch(selectedItem.filePath)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status} for ${selectedItem.filePath}`);
                        }
                        return response.text();
                    })
                    .then(text => {
                        if (selectedItem.filePath.endsWith('.md')) {
                            setActiveDocumentContent(marked.parse(text));
                        } else {
                            setActiveDocumentContent(text);
                        }
                    })
                    .catch(error => {
                        console.error("Error fetching document:", error);
                        setActiveDocumentContent(`<p style="color:red;">Error loading content from ${selectedItem.filePath}. Check console.</p>`);
                    })
                    .finally(() => setIsLoadingContent(false));
            } else {
                setActiveDocumentContent('<p>No content or file path defined for this document.</p>');
                setIsLoadingContent(false);
            }
        } else if (selectedItem && selectedItem.type === 'category') {
             setActiveDocumentContent(`<p>This is the '<strong>${selectedItem.name}</strong>' category. Select a document or add a sub-item.</p>`);
             setIsLoadingContent(false);
        } else {
            setActiveDocumentContent('<p>Select an item from the sidebar.</p>');
            setIsLoadingContent(false);
        }
    }, [selectedItem]);


    // --- Event Handlers ---
    const handleSelectItem = (itemId) => {
        setActiveItemId(itemId);
        setIsEditModalOpen(false);
    };

    const handleShowContextMenu = (event, itemId, itemType) => {
        event.preventDefault();
        setContextMenu({ visible: true, x: event.pageX, y: event.pageY, targetId: itemId, itemType: itemType });
    };

    const handleHideContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, visible: false }));
    }, []);

    useEffect(() => {
        if (contextMenu.visible) {
            document.addEventListener('click', handleHideContextMenu);
            return () => document.removeEventListener('click', handleHideContextMenu);
        }
    }, [contextMenu.visible, handleHideContextMenu]);


    const openAddDocumentModal = (parentId = null) => {
        const parentItem = parentId ? findItemById(data, parentId) : null;
        setAddDocumentParentInfo({ id: parentId, name: parentItem ? parentItem.name : '' });
        setIsAddDocumentModalOpen(true);
        handleHideContextMenu();
    };

    const handleSaveNewDocument = (newDocDataFromModal) => {
        const newItem = {
            id: generateId(),
            ...newDocDataFromModal
        };

        if (addDocumentParentInfo.id) {
            const parentItem = findItemById(data, addDocumentParentInfo.id);
            if (parentItem && parentItem.type === 'category') {
                 setData(prevData => deepCloneAndAddChild(prevData, addDocumentParentInfo.id, newItem));
            } else {
                console.error('Cannot add document: Invalid parent.');
                setData(prevData => [...prevData, newItem].sort((a,b) => a.name.localeCompare(b.name)));
            }
        } else {
            setData(prevData => [...prevData, newItem].sort((a,b) => a.name.localeCompare(b.name)));
        }
        handleSelectItem(newItem.id);
    };

    const handleAddItem = (parentId = null, type = 'category') => {
        if (type === 'document') {
            openAddDocumentModal(parentId);
            return;
        }

        const name = prompt(`Enter name for new ${type}:`);
        if (!name) return;

        const newItem = {
            id: generateId(), name: name, type: type,
            ...(type === 'category' ? { children: [] } : {}),
        };

        if (parentId) {
            const parentItem = findItemById(data, parentId);
            if (parentItem && parentItem.type === 'category') {
                 setData(prevData => deepCloneAndAddChild(prevData, parentId, newItem));
            } else {
                alert('Cannot add to this item type or parent not found.'); return;
            }
        } else {
            setData(prevData => [...prevData, newItem].sort((a,b) => a.name.localeCompare(b.name)));
        }
        handleHideContextMenu();
    };

    const handleRenameItem = () => {
        const { targetId } = contextMenu; if (!targetId) return;
        const item = findItemById(data, targetId); if (!item) return;
        const newName = prompt('Enter new name:', item.name);
        if (newName && newName !== item.name) {
            setData(prevData => deepCloneAndUpdate(prevData, targetId, currentItem => ({...currentItem, name: newName })));
        }
        handleHideContextMenu();
    };

    const handleDeleteItem = () => {
        const { targetId } = contextMenu; if (!targetId) return;
        if (!confirm('Are you sure you want to delete this item and all its children?')) {
            handleHideContextMenu(); return;
        }
        setData(prevData => deepCloneAndRemove(prevData, targetId));
        if (activeItemId === targetId) setActiveItemId(null);
        handleHideContextMenu();
    };

    const handleOpenEditModal = async () => {
        if (selectedItem && selectedItem.type === 'document') {
            let contentToEdit = selectedItem.content || '';

            if (selectedItem.filePath && !selectedItem.content) {
                try {
                    setIsLoadingContent(true);
                    const response = await fetch(selectedItem.filePath);
                    if (!response.ok) throw new Error(`Failed to fetch raw content for editing: ${selectedItem.filePath}`);
                    contentToEdit = await response.text();
                    setIsLoadingContent(false);
                } catch (error) {
                    console.error("Error fetching raw document for edit:", error);
                    alert(`Could not load the original file content for editing: ${error.message}. You'll edit the last known version or a blank slate.`);
                    contentToEdit = activeDocumentContent || '';
                    setIsLoadingContent(false);
                }
            }

            setEditingDocument({
                id: selectedItem.id,
                name: selectedItem.name,
                content: contentToEdit,
            });
            setIsEditModalOpen(true);
        }
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingDocument(null);
    };

    const handleSaveEditedDocument = (newContent) => {
        if (!editingDocument || !editingDocument.id) return;
        setData(prevData => deepCloneAndUpdate(prevData, editingDocument.id, currentItem => ({
            ...currentItem,
            content: newContent,
            lastUpdated: new Date().toLocaleDateString(),
            filePath: undefined
        })));
        handleCloseEditModal();
    };

    useEffect(() => {
        if (data.length > 0 && !activeItemId) {
            const firstDoc = data.find(item => item.type === 'document') ||
                             (data[0].type === 'category' && data[0].children && data[0].children.find(child => child.type === 'document'));
            if (firstDoc) handleSelectItem(firstDoc.id);
            else if (data[0]) handleSelectItem(data[0].id);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);


    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>DOCUMENTATION</h2>
                    <button onClick={() => handleAddItem(null, 'category')} title="Add Top-Level Category">+</button>
                </div>
                <ul id="categoryTree" className="category-tree">
                    {data.sort((a,b) => a.name.localeCompare(b.name)).map(item => (
                        <CategoryItem
                            key={item.id}
                            item={item}
                            level={0}
                            onSelectItem={handleSelectItem}
                            onShowContextMenu={handleShowContextMenu}
                            activeItemId={activeItemId}
                        />
                    ))}
                </ul>
                <div className="quick-tips">
                    <h4>⚡ Quick Tips</h4>
                    <ul>
                        <li>Right-click (⋮) for options.</li>
                        <li>Click items to view.</li>
                    </ul>
                </div>
            </aside>

            <main className="content-pane">
                <div className="content-header">
                    <h1>{selectedItem ? selectedItem.name : 'Select a document'}</h1>
                    {selectedItem && selectedItem.type === 'document' && selectedItem.lastUpdated && (
                        <p id="documentLastUpdated">Last updated: {selectedItem.lastUpdated}</p>
                    )}
                    {selectedItem && selectedItem.type === 'document' && (
                        <button id="editDocumentBtn" onClick={handleOpenEditModal}>Edit</button>
                    )}
                </div>

                {isLoadingContent ? (
                    <p>Loading content...</p>
                ) : (
                    <div
                        id="documentContent"
                        className="document-body"
                        dangerouslySetInnerHTML={{ __html: activeDocumentContent }}
                    />
                )}
            </main>

            {contextMenu.visible && (
                <div
                    id="contextMenu" className="context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="context-menu-item" onClick={handleRenameItem}>Rename</div>
                    {contextMenu.itemType === 'category' && (
                        <>
                            <div className="context-menu-item" onClick={() => handleAddItem(contextMenu.targetId, 'category')}>Add Subcategory</div>
                            <div className="context-menu-item" onClick={() => handleAddItem(contextMenu.targetId, 'document')}>Add Document</div>
                        </>
                    )}
                    <div className="context-menu-item delete" onClick={handleDeleteItem}>Delete</div>
                </div>
            )}

            {editingDocument && (
                <EditModal
                    isOpen={isEditModalOpen}
                    onClose={handleCloseEditModal}
                    initialContent={editingDocument.content}
                    onSave={handleSaveEditedDocument}
                    documentName={editingDocument.name}
                />
            )}

            <AddDocumentModal
                isOpen={isAddDocumentModalOpen}
                onClose={() => setIsAddDocumentModalOpen(false)}
                onSave={handleSaveNewDocument}
                parentName={addDocumentParentInfo.name}
            />
        </div>
    );
} // <<<< END OF THE SINGLE, CORRECT App FUNCTION DEFINITION


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// THIS IS THE START OF THE DUPLICATE CODE YOU NEED TO DELETE
// It starts around where your previous App component ended and a new `function App()` began.
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

/*
// src/App.jsx
// ... other imports
import AddDocumentModal from './AddDocumentModal'; // Import the new modal

// ... (CategoryItem, initialData, generateId, findItemById, deepCloneAndUpdate, etc. remain the same)

function App() { // <<<<<<<<<<<<<<<<<<< THIS IS THE START OF THE DUPLICATE BLOCK
    // ... (existing state variables: data, activeItemId, activeDocumentContent, etc.)
    const [isAddDocumentModalOpen, setIsAddDocumentModalOpen] = useState(false);
    const [addDocumentParentInfo, setAddDocumentParentInfo] = useState({ id: null, name: '' }); // For context in modal

    // ... (existing utility functions, content fetching useEffect)

    // --- Event Handlers ---
    // ... (handleSelectItem, handleShowContextMenu, handleHideContextMenu, useEffect for context menu)

    const openAddDocumentModal = (parentId = null) => {
        const parentItem = parentId ? findItemById(data, parentId) : null;
        setAddDocumentParentInfo({ id: parentId, name: parentItem ? parentItem.name : '' });
        setIsAddDocumentModalOpen(true);
        handleHideContextMenu(); // Close context menu if it was open
    };

    const handleSaveNewDocument = (newDocDataFromModal) => {
        const newItem = {
            id: generateId(),
            ...newDocDataFromModal // This will include name, type: 'document', and content/filePath
        };

        // If it's a sub-document
        if (addDocumentParentInfo.id) {
            const parentItem = findItemById(data, addDocumentParentInfo.id);
            if (parentItem && parentItem.type === 'category') {
                 setData(prevData => deepCloneAndAddChild(prevData, addDocumentParentInfo.id, newItem));
            } else {
                // Should not happen if UI is correct, but as a fallback
                console.error('Cannot add document: Invalid parent.');
                setData(prevData => [...prevData, newItem].sort((a,b) => a.name.localeCompare(b.name)));
            }
        } else { // Top-level document
            setData(prevData => [...prevData, newItem].sort((a,b) => a.name.localeCompare(b.name)));
        }
        handleSelectItem(newItem.id); // Select and display the new document
    };


    // MODIFIED: handleAddItem - now primarily for categories, or delegates to modal for docs
    const handleAddItem = (parentId = null, type = 'category') => { // Default to category for top-level button
        if (type === 'document') {
            openAddDocumentModal(parentId); // Open new modal for documents
            return;
        }

        // Existing logic for adding categories
        const name = prompt(`Enter name for new ${type}:`);
        if (!name) return;

        const newItem = {
            id: generateId(), name: name, type: type,
            ...(type === 'category' ? { children: [] } : {}),
            // Document specific content/filePath is now handled by AddDocumentModal
        };

        if (parentId) {
            const parentItem = findItemById(data, parentId);
            if (parentItem && parentItem.type === 'category') {
                 setData(prevData => deepCloneAndAddChild(prevData, parentId, newItem));
            } else {
                alert('Cannot add to this item type or parent not found.'); return;
            }
        } else {
            setData(prevData => [...prevData, newItem].sort((a,b) => a.name.localeCompare(b.name)));
        }
        handleHideContextMenu();
        // No need to select if it's a category, documents are handled by handleSaveNewDocument
    };

    // ... (handleRenameItem, handleDeleteItem)

    // --- Edit Modal Handling (handleOpenEditModal) ---
    // IMPORTANT: Logic for fetching raw content for editing filePath docs needs refinement.
    const handleOpenEditModal = async () => { // Made async for potential fetch
        if (selectedItem && selectedItem.type === 'document') {
            let contentToEdit = selectedItem.content || ''; // Default for inline

            if (selectedItem.filePath && !selectedItem.content) {
                // Fetch raw content for editing if it's a file-linked document
                try {
                    setIsLoadingContent(true); // Show loading indicator
                    const response = await fetch(selectedItem.filePath);
                    if (!response.ok) throw new Error(`Failed to fetch raw content for editing: ${selectedItem.filePath}`);
                    contentToEdit = await response.text();
                    setIsLoadingContent(false);
                } catch (error) {
                    console.error("Error fetching raw document for edit:", error);
                    alert(`Could not load the original file content for editing: ${error.message}. You'll edit the last known version or a blank slate.`);
                    // Fallback to currently displayed activeDocumentContent if fetch fails, or blank.
                    // This might be the parsed HTML, which is not ideal for editing Markdown.
                    contentToEdit = activeDocumentContent || '';
                    setIsLoadingContent(false);
                }
            }

            setEditingDocument({
                id: selectedItem.id,
                name: selectedItem.name,
                content: contentToEdit,
            });
            setIsEditModalOpen(true);
        }
    };

    // ... (handleCloseEditModal, handleSaveEditedDocument)
    // ... (useEffect for initial item selection)

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>DOCUMENTATION</h2>
                    <button onClick={() => handleAddItem(null, 'category')} title="Add Top-Level Category">+</button>
                </div>
                // ... rest of sidebar JSX ...
            </aside>

            // ... rest of main content pane JSX ...

            {contextMenu.visible && (
                <div // ... context menu JSX ... / >
                    <div className="context-menu-item" onClick={handleRenameItem}>Rename</div>
                    {contextMenu.itemType === 'category' && (
                        <>
                            <div className="context-menu-item" onClick={() => handleAddItem(contextMenu.targetId, 'category')}>Add Subcategory</div>
                            <div className="context-menu-item" onClick={() => handleAddItem(contextMenu.targetId, 'document')}>Add Document</div>
                        </>
                    )}
                    <div className="context-menu-item delete" onClick={handleDeleteItem}>Delete</div>
                </div>
            )}

            {editingDocument && (
                <EditModal
                    isOpen={isEditModalOpen}
                    onClose={handleCloseEditModal}
                    initialContent={editingDocument.content}
                    onSave={handleSaveEditedDocument}
                    documentName={editingDocument.name}
                />
            )}

            <AddDocumentModal
                isOpen={isAddDocumentModalOpen}
                onClose={() => setIsAddDocumentModalOpen(false)}
                onSave={handleSaveNewDocument}
                parentName={addDocumentParentInfo.name}
            />
        </div>
    );
} // <<<<<<<<<<<<<<<<<<< THIS IS THE END OF THE DUPLICATE BLOCK
*/

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// END OF THE DUPLICATE CODE YOU NEED TO DELETE
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


export default App;