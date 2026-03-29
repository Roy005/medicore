'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { getMyPatientId } from '@/lib/patient';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Upload, Download, Trash2, Search, Filter, Clock, File, Image, FileSpreadsheet, X } from 'lucide-react';

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  category: string;
  uploadedAt: string;
  fileSize?: number;
}

const CATEGORIES = ['All', 'Lab Results', 'Imaging', 'Prescriptions', 'Discharge Summary', 'Insurance', 'Other'];

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [patientId, setPatientId] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const pid = await getMyPatientId();
      setPatientId(pid);
      return pid;
    } catch {}
    return null;
  }, []);

  const fetchDocuments = useCallback(async (pid: string) => {
    try {
      const res = await api.get(`/patients/${pid}/documents`);
      setDocuments(Array.isArray(res.data) ? res.data : []);
    } catch { setDocuments([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile().then((pid) => {
      if (pid) fetchDocuments(pid);
      else setLoading(false);
    });
  }, [fetchProfile, fetchDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !patientId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'Other');
      await api.post(`/patients/${patientId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchDocuments(patientId);
      setShowUpload(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!patientId || !confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/patients/${patientId}/documents/${docId}`);
      setDocuments(documents.filter(d => d.id !== docId));
    } catch { alert('Failed to delete document.'); }
  };

  const filteredDocs = documents.filter(d => {
    const matchSearch = d.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory === 'All' || d.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  const getFileIcon = (type: string) => {
    if (type?.includes('image')) return <Image className="w-5 h-5 text-[#E8533A]" />;
    if (type?.includes('spreadsheet') || type?.includes('csv')) return <FileSpreadsheet className="w-5 h-5 text-[#4CAF82]" />;
    return <File className="w-5 h-5 text-[#4c5f7e]" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#191c1d]">Documents</h1>
          <p className="text-sm text-[#3e4948] mt-1">Upload and manage your medical records.</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
        >
          <Upload className="w-4 h-4" /> Upload Document
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e7979]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm text-[#191c1d] placeholder:text-[#bec9c8] focus:outline-none focus:ring-2 focus:ring-[#005454]"
            style={{ backgroundColor: '#e1e3e4' }}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#005454] text-white'
                  : 'bg-[#f2f4f5] text-[#3e4948] hover:bg-[#e6e8e9]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)]">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-[#f2f4f5] rounded-lg animate-pulse" />)}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-[#bec9c8] mb-4" />
            <p className="text-sm text-[#6e7979]">
              {documents.length === 0 ? 'No documents uploaded yet.' : 'No documents match your search.'}
            </p>
            <p className="text-xs text-[#bec9c8] mt-1">
              Upload lab results, prescriptions, imaging reports, and more.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#f2f4f5]">
            {filteredDocs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#f8fafb] transition-colors">
                <div className="w-10 h-10 rounded-lg bg-[#f2f4f5] flex items-center justify-center flex-shrink-0">
                  {getFileIcon(doc.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#191c1d] truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] font-semibold text-[#005454] bg-[#005454]/10 px-2 py-0.5 rounded">
                      {doc.category || 'Other'}
                    </span>
                    <span className="text-[11px] text-[#6e7979] font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-[#f2f4f5] text-[#6e7979] hover:text-[#005454] transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(doc.id)} className="p-2 rounded-lg hover:bg-[#ffdad6] text-[#6e7979] hover:text-[#ba1a1a] transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-[#e6e8e9]">
              <h2 className="text-lg font-bold text-[#191c1d]">Upload Document</h2>
              <button onClick={() => setShowUpload(false)} className="text-[#6e7979] hover:text-[#191c1d]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="flex flex-col items-center justify-center w-full h-48 rounded-lg cursor-pointer hover:bg-[#f2f4f5] transition-colors" style={{ border: '2px dashed var(--outline-variant)' }}>
                <Upload className="w-8 h-8 text-[#6e7979] mb-3" />
                <p className="text-sm font-medium text-[#191c1d]">Click to upload</p>
                <p className="text-xs text-[#6e7979] mt-1">PDF, JPG, PNG up to 10MB</p>
                <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
              </label>
              {uploading && (
                <div className="mt-4 flex items-center gap-2 text-sm text-[#005454]">
                  <div className="w-4 h-4 border-2 border-[#005454] border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
