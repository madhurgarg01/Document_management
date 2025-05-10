// src/AddDocumentModal.jsx
import { useState } from 'react';
import './AddDocumentModal.css'; // We'll create this CSS file

function AddDocumentModal({ isOpen, onClose, onSave, parentName }) {
    const [docName, setDocName] = useState('');
    const [docType, setDocType] = useState('blank'); // 'blank', 'link', 'upload'
    const [filePath, setFilePath] = useState('');
    const [fileError, setFileError] = useState('');

    if (!isOpen) {
        return null;
    }

    const resetForm = () => {
        setDocName('');
        setDocType('blank');
        setFilePath('');
        setFileError('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSave = async () => {
        if (!docName.trim()) {
            alert('Document name is required.');
            return;
        }

        let newDocData = {
            name: docName.trim(),
            type: 'document', // This is a document item in the tree
        };

        if (docType === 'blank') {
            newDocData.content = '<h1>New Document</h1><p>Start editing your content here.</p>';
            newDocData.lastUpdated = new Date().toLocaleDateString();
        } else if (docType === 'link') {
            if (!filePath.trim() || (!filePath.endsWith('.md') && !filePath.endsWith('.html'))) {
                alert('Valid file path (ending in .md or .html) is required for linking.\nExample: /documents/myfile.md');
                return;
            }
            newDocData.filePath = filePath.trim();
            // lastUpdated will be set when content is first loaded or if it's later edited inline
        } else if (docType === 'upload') {
            const fileInput = document.getElementById('localFileUploader');
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                setFileError('Please select a file to upload.');
                return;
            }
            const file = fileInput.files[0];
            if (!file.name.endsWith('.md') && !file.name.endsWith('.html')) {
                setFileError('Please select a .md or .html file.');
                return;
            }

            try {
                const fileContent = await readFileContent(file);
                newDocData.content = fileContent;
                newDocData.lastUpdated = new Date().toLocaleDateString();
                setFileError('');
            } catch (error) {
                console.error("Error reading file:", error);
                setFileError('Error reading file content.');
                return;
            }
        }

        onSave(newDocData);
        handleClose();
    };

    const readFileContent = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    };


    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content add-doc-modal" onClick={(e) => e.stopPropagation()}>
                <h2>Add New Document {parentName ? `to '${parentName}'` : ''}</h2>

                <div className="form-group">
                    <label htmlFor="docName">Document Name:</label>
                    <input
                        type="text"
                        id="docName"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        placeholder="My Awesome Document"
                    />
                </div>

                <div className="form-group">
                    <label>Document Type:</label>
                    <div>
                        <label className="radio-label">
                            <input
                                type="radio"
                                name="docType"
                                value="blank"
                                checked={docType === 'blank'}
                                onChange={(e) => setDocType(e.target.value)}
                            /> New Blank Document
                        </label>
                        <label className="radio-label">
                            <input
                                type="radio"
                                name="docType"
                                value="link"
                                checked={docType === 'link'}
                                onChange={(e) => setDocType(e.target.value)}
                            /> Link to Existing Server File
                        </label>
                        <label className="radio-label">
                            <input
                                type="radio"
                                name="docType"
                                value="upload"
                                checked={docType === 'upload'}
                                onChange={(e) => setDocType(e.target.value)}
                            /> Create from Local File (Upload Content)
                        </label>
                    </div>
                </div>

                {docType === 'link' && (
                    <div className="form-group">
                        <label htmlFor="filePath">File Path on Server:</label>
                        <input
                            type="text"
                            id="filePath"
                            value={filePath}
                            onChange={(e) => setFilePath(e.target.value)}
                            placeholder="/documents/example.md or /documents/example.html"
                        />
                        <small>Path relative to the 'public' folder. E.g., if your file is in `public/documents/intro.md`, enter `/documents/intro.md`</small>
                    </div>
                )}

                {docType === 'upload' && (
                    <div className="form-group">
                        <label htmlFor="localFileUploader">Select Local File (.md or .html):</label>
                        <input
                            type="file"
                            id="localFileUploader"
                            accept=".md,.html,text/markdown,text/html"
                            onChange={() => setFileError('')} // Clear error on new selection
                        />
                        {fileError && <p className="error-message">{fileError}</p>}
                    </div>
                )}


                <div className="modal-actions">
                    <button onClick={handleSave} className="save-btn">Add Document</button>
                    <button onClick={handleClose} className="cancel-btn">Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default AddDocumentModal;