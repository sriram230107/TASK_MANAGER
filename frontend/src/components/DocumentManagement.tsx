import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    documentService,
    type DocumentItem,
    type DocumentCategory,
    type DocumentScope
} from '../services/document.service';

export const DocumentManagement: React.FC = () => {
    const { user } = useAuth();
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Filters
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [scopeFilter, setScopeFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Upload modal state
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadForm, setUploadForm] = useState<{
        title: string;
        description: string;
        category: DocumentCategory;
        accessScope: DocumentScope;
        departmentId: string;
    }>({
        title: '',
        description: '',
        category: 'OTHER',
        accessScope: 'ORGANIZATION',
        departmentId: ''
    });

    const isAdmin = user?.role === 'ADMIN';
    const isManager = user?.role === 'MANAGER';

    const loadDocuments = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await documentService.list({
                category: categoryFilter === 'ALL' ? undefined : (categoryFilter as DocumentCategory),
                accessScope: scopeFilter === 'ALL' ? undefined : (scopeFilter as DocumentScope),
                search: searchQuery.trim() || undefined
            });
            setDocuments(data.documents);
        } catch (err: any) {
            console.error('Failed to load documents:', err);
            setError(err.response?.data?.message || err.message || 'Failed to load documents');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, [categoryFilter, scopeFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        loadDocuments();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 15 * 1024 * 1024) {
                alert('File size exceeds the 15MB limit.');
                return;
            }
            setSelectedFile(file);
            if (!uploadForm.title) {
                setUploadForm((prev) => ({
                    ...prev,
                    title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
                }));
            }
        }
    };

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            setError('Please select a file to upload.');
            return;
        }

        setIsUploading(true);
        setError(null);
        try {
            await documentService.upload({
                title: uploadForm.title,
                description: uploadForm.description || undefined,
                category: uploadForm.category,
                accessScope: uploadForm.accessScope,
                departmentId: uploadForm.departmentId || undefined,
                file: selectedFile
            });

            setSuccessMessage('Document uploaded successfully!');
            setTimeout(() => setSuccessMessage(null), 4000);
            setIsUploadModalOpen(false);
            setSelectedFile(null);
            setUploadForm({
                title: '',
                description: '',
                category: 'OTHER',
                accessScope: 'ORGANIZATION',
                departmentId: ''
            });
            await loadDocuments();
        } catch (err: any) {
            console.error('Upload document error:', err);
            setError(err.response?.data?.message || err.message || 'Failed to upload document');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
            return;
        }

        try {
            await documentService.delete(id);
            setSuccessMessage('Document deleted successfully.');
            setTimeout(() => setSuccessMessage(null), 3000);
            setDocuments((prev) => prev.filter((d) => d.id !== id));
        } catch (err: any) {
            console.error('Delete document error:', err);
            setError(err.response?.data?.message || err.message || 'Failed to delete document');
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getScopeBadge = (scope: DocumentScope) => {
        switch (scope) {
            case 'ORGANIZATION':
                return <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>Org-Wide</span>;
            case 'DEPARTMENT':
                return <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600 }}>Department</span>;
            case 'TEAM':
                return <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', fontSize: '0.75rem', fontWeight: 600 }}>Team</span>;
            case 'CONFIDENTIAL':
                return <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>Confidential</span>;
        }
    };

    const getCategoryIcon = (category: DocumentCategory) => {
        switch (category) {
            case 'POLICY': return '📜';
            case 'ANNOUNCEMENT': return '📢';
            case 'CONTRACT': return '📝';
            case 'IDENTIFICATION': return '🪪';
            case 'REPORT': return '📊';
            case 'OTHER': default: return '📁';
        }
    };

    // Calculate quick stats
    const totalDocs = documents.length;
    const policyCount = documents.filter((d) => d.category === 'POLICY' || d.category === 'ANNOUNCEMENT').length;
    const reportCount = documents.filter((d) => d.category === 'REPORT').length;
    const personalCount = documents.filter((d) => d.uploadedById === user?.id).length;

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        Documents & Policies
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Centralized repository for organization guidelines, department records, and attachments.
                    </p>
                </div>

                <button
                    onClick={() => setIsUploadModalOpen(true)}
                    style={{
                        padding: '10px 20px',
                        background: 'var(--accent-color)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                >
                    <span>📤</span> Upload Document
                </button>
            </div>

            {/* Notification Alerts */}
            {successMessage && (
                <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#10b981', marginBottom: '20px', fontSize: '0.9rem' }}>
                    ✔ {successMessage}
                </div>
            )}
            {error && (
                <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444', marginBottom: '20px', fontSize: '0.9rem' }}>
                    ⚠ {error}
                </div>
            )}

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Documents</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>{totalDocs}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Accessible in your scope</div>
                </div>

                <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Policies & Notices</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981', marginTop: '6px' }}>{policyCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Official company guidelines</div>
                </div>

                <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Reports & Summaries</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#3b82f6', marginTop: '6px' }}>{reportCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Department & org reviews</div>
                </div>

                <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>My Uploads</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#8b5cf6', marginTop: '6px' }}>{personalCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Uploaded by you</div>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div style={{ background: 'var(--card-bg)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '4px' }}>Category:</span>
                    {['ALL', 'POLICY', 'ANNOUNCEMENT', 'REPORT', 'CONTRACT', 'IDENTIFICATION', 'OTHER'].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: categoryFilter === cat ? 'var(--accent-color)' : 'var(--border-color)',
                                background: categoryFilter === cat ? 'var(--accent-color)' : 'transparent',
                                color: categoryFilter === cat ? '#fff' : 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                cursor: 'pointer'
                            }}
                        >
                            {cat === 'ALL' ? 'All Types' : cat}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={scopeFilter}
                        onChange={(e) => setScopeFilter(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem'
                        }}
                    >
                        <option value="ALL">All Scopes</option>
                        <option value="ORGANIZATION">Organization</option>
                        <option value="DEPARTMENT">Department</option>
                        <option value="TEAM">Team</option>
                        {(isAdmin || isManager) && <option value="CONFIDENTIAL">Confidential</option>}
                    </select>

                    <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '6px' }}>
                        <input
                            type="text"
                            placeholder="Search documents..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                minWidth: '180px'
                            }}
                        />
                        <button
                            type="submit"
                            style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: 'var(--accent-color)',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            🔍
                        </button>
                    </form>
                </div>
            </div>

            {/* Document List */}
            {isLoading ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>Loading documents...</p>
                </div>
            ) : documents.length === 0 ? (
                <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '60px 20px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '3rem' }}>📂</span>
                    <h3 style={{ margin: '16px 0 6px 0', color: 'var(--text-primary)' }}>No Documents Found</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 20px auto' }}>
                        No files match the selected filter criteria or have been shared in your scope yet.
                    </p>
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        style={{
                            padding: '8px 16px',
                            background: 'var(--accent-color)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        Upload First Document
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {documents.map((doc) => {
                        const canDelete = isAdmin || (isManager && doc.departmentId === user?.departmentId) || doc.uploadedById === user?.id;

                        return (
                            <div
                                key={doc.id}
                                style={{
                                    background: 'var(--card-bg)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    padding: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    boxShadow: 'var(--card-shadow)',
                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '1.8rem' }}>{getCategoryIcon(doc.category)}</span>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                                    {doc.title}
                                                </h3>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {doc.category}
                                                </span>
                                            </div>
                                        </div>
                                        {getScopeBadge(doc.accessScope)}
                                    </div>

                                    {doc.description && (
                                        <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {doc.description}
                                        </p>
                                    )}

                                    <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span>File:</span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {doc.fileName}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span>Size:</span>
                                            <span>{formatBytes(doc.sizeBytes)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Uploaded by:</span>
                                            <span style={{ color: 'var(--text-primary)' }}>{doc.uploadedBy.name}</span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {new Date(doc.createdAt).toLocaleDateString()}
                                    </span>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await documentService.download(doc.id, doc.fileName);
                                                } catch (err: any) {
                                                    setError('Failed to download document: ' + (err.response?.data?.error?.message || err.message));
                                                }
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                background: 'rgba(59, 130, 246, 0.1)',
                                                color: '#3b82f6',
                                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            📥 Download
                                        </button>

                                        {canDelete && (
                                            <button
                                                onClick={() => handleDelete(doc.id)}
                                                style={{
                                                    padding: '6px 10px',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    color: '#ef4444',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer'
                                                }}
                                                title="Delete document"
                                            >
                                                🗑
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'var(--card-bg)',
                        borderRadius: '16px',
                        maxWidth: '560px',
                        width: '100%',
                        padding: '28px',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                Upload New Document
                            </h2>
                            <button
                                onClick={() => setIsUploadModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleUploadSubmit}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                    Document Title *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Employee Handbook 2026"
                                    value={uploadForm.title}
                                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                        Category *
                                    </label>
                                    <select
                                        value={uploadForm.category}
                                        onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value as DocumentCategory })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        {(isAdmin || isManager) && <option value="POLICY">Policy</option>}
                                        {(isAdmin || isManager) && <option value="ANNOUNCEMENT">Announcement</option>}
                                        <option value="REPORT">Report</option>
                                        <option value="CONTRACT">Contract</option>
                                        <option value="IDENTIFICATION">Identification</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                        Access Scope *
                                    </label>
                                    <select
                                        value={uploadForm.accessScope}
                                        onChange={(e) => setUploadForm({ ...uploadForm, accessScope: e.target.value as DocumentScope })}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        <option value="ORGANIZATION">Organization-Wide</option>
                                        <option value="DEPARTMENT">Department</option>
                                        <option value="TEAM">Team</option>
                                        {(isAdmin || isManager) && <option value="CONFIDENTIAL">Confidential</option>}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                    Description
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Brief overview or instructions about this document..."
                                    value={uploadForm.description}
                                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            {/* File Upload Drop Area */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                    Select File * (Max 15MB)
                                </label>
                                <div style={{
                                    border: '2px dashed var(--border-color)',
                                    borderRadius: '10px',
                                    padding: '24px',
                                    textAlign: 'center',
                                    background: selectedFile ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-secondary)',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="file"
                                        id="doc-file-input"
                                        required
                                        onChange={handleFileChange}
                                        style={{ display: 'none' }}
                                    />
                                    <label htmlFor="doc-file-input" style={{ cursor: 'pointer', display: 'block' }}>
                                        {selectedFile ? (
                                            <div>
                                                <span style={{ fontSize: '2rem' }}>📄</span>
                                                <div style={{ marginTop: '8px', fontWeight: 600, color: '#10b981' }}>{selectedFile.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatBytes(selectedFile.size)}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--accent-color)', marginTop: '8px' }}>Click to choose a different file</div>
                                            </div>
                                        ) : (
                                            <div>
                                                <span style={{ fontSize: '2.5rem' }}>📁</span>
                                                <div style={{ marginTop: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>Click to browse or drop file here</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                    PDF, Word, Excel, CSV, PNG, JPG, ZIP
                                                </div>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsUploadModalOpen(false)}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        background: 'transparent',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isUploading || !selectedFile}
                                    style={{
                                        padding: '10px 22px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'var(--accent-color)',
                                        color: '#fff',
                                        cursor: isUploading || !selectedFile ? 'not-allowed' : 'pointer',
                                        fontWeight: 600,
                                        opacity: isUploading || !selectedFile ? 0.7 : 1
                                    }}
                                >
                                    {isUploading ? 'Uploading...' : 'Upload File'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
