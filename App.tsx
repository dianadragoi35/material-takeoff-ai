
import React, { useState } from 'react';
import type { ResultFile, ConsolidatedSummary } from './types';
import { analyzePdfWithGemini } from './services/geminiService';
import { Upload, FileText, Download, Loader2, CheckCircle, AlertCircle, Building2, X } from './components/icons';

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [contextFiles, setContextFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ResultFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analysisStage, setAnalysisStage] = useState('');
  const [contextMode, setContextMode] = useState(true);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const uploadedFiles = Array.from(event.target.files);
    const pdfFiles = uploadedFiles.filter((f: File) => f.type === 'application/pdf');
    
    if (pdfFiles.length !== uploadedFiles.length) {
      setError('Only PDF files are supported. Non-PDF files have been ignored.');
    } else {
        setError(null);
    }

    if (pdfFiles.length > 0) {
        setFiles(prev => [...prev, ...pdfFiles]);
    }
    setResults([]);
  };
  
  const handleContextFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const uploadedFiles = Array.from(event.target.files);
    const pdfFiles = uploadedFiles.filter((f: File) => f.type === 'application/pdf');
    setContextFiles(prev => [...prev, ...pdfFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
    setResults(results.filter((_, i) => i !== index));
  };

  const removeContextFile = (index: number) => {
    setContextFiles(contextFiles.filter((_, i) => i !== index));
  };

  const analyzePDFs = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setError(null);
    setResults([]);
    const allResults: ResultFile[] = [];
    let contextSummary = '';

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setAnalysisStage(`Processing file ${i + 1} of ${files.length}: ${file.name}`);

        if (contextMode && allResults.length > 0) {
          const roofRelatedResults = allResults.filter(r => r.isRoofRelated);
          if (roofRelatedResults.length > 0) {
            contextSummary = `\n\nCONTEXT FROM PREVIOUSLY ANALYZED DOCUMENTS:\n`;
            roofRelatedResults.forEach((prevResult, idx) => {
              contextSummary += `\nDocument ${idx + 1}: ${prevResult.fileName}\n`;
              contextSummary += `- Document Type: ${prevResult.documentType}\n`;
              contextSummary += `- Scale: ${prevResult.scale}\n`;
              if (prevResult.materials && prevResult.materials.length > 0) {
                contextSummary += `- Materials found: ${prevResult.materials.map(m => m.material).join(', ')}\n`;
              }
              contextSummary += `- Notes: This document may contain specifications, legends, or area measurements that relate to the current document\n`;
            });
            contextSummary += `\nUSE THIS CONTEXT: If the current document references materials or specifications from previous documents, use that information to enhance your analysis. If previous documents contained legends/specifications and this document shows areas, combine the information.\n`;
          }
        }

        setAnalysisStage(`Analyzing ${file.name} with Gemini AI...`);
        
        const analysisResults = await analyzePdfWithGemini(file, contextFiles, contextSummary);

        allResults.push({
          fileName: file.name,
          ...analysisResults
        });
        setResults([...allResults]);
      }
      setAnalysisStage('');
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? `Analysis failed: ${err.message}` : 'An unknown error occurred.');
      setAnalysisStage('');
    } finally {
      setProcessing(false);
    }
  };

  const exportToJSON = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roof-takeoff-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    if (!results || results.length === 0) return;

    const roofResults = results.filter(r => r.isRoofRelated);
    const headers = ['Code', 'Material', 'Area (m²)', 'Unit', 'Confidence', 'Notes', 'File Name'];
    const rows = [];
    
    roofResults.forEach(result => {
      result.materials?.forEach(m => {
        rows.push([
          m.code || '',
          m.material,
          m.area,
          m.unit,
          m.confidence,
          m.notes || '',
          result.fileName
        ]);
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const dataBlob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roof-takeoff-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getConsolidatedSummary = (): ConsolidatedSummary | null => {
    const roofResults = results.filter(r => r.isRoofRelated);
    if (roofResults.length === 0) return null;

    const materialMap = new Map();
    
    roofResults.forEach(result => {
      result.materials?.forEach(m => {
        if (!m || typeof m.material !== 'string') return;
        const key = m.material.toLowerCase().trim();
        if (materialMap.has(key)) {
          const existing = materialMap.get(key);
          materialMap.set(key, {
            ...existing,
            area: existing.area + (m.area || 0),
            confidence: (existing.confidence * existing.sources.length + (m.confidence || 0)) / (existing.sources.length + 1),
            sources: [...existing.sources, result.fileName]
          });
        } else {
          materialMap.set(key, {
            material: m.material,
            code: m.code || '',
            area: m.area || 0,
            unit: m.unit,
            confidence: m.confidence || 0,
            sources: [result.fileName]
          });
        }
      });
    });

    const consolidatedMaterials = Array.from(materialMap.values());
    const totalArea = consolidatedMaterials.reduce((acc, m) => acc + m.area, 0);

    return {
      materials: consolidatedMaterials,
      totalArea,
      roofPlanCount: roofResults.length,
      totalPlanCount: results.length
    };
  };

  const consolidatedSummary = getConsolidatedSummary();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Material Takeoff AI</h1>
          <p className="text-gray-600">Automated roof plan analysis for construction estimating with Gemini</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-1">Step 1: Upload Roof Plans</h2>
          <p className="text-sm text-gray-500 mb-4">Select the primary PDF files you want to analyze.</p>
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full min-h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                <Upload className="w-12 h-12 mb-4 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PDF roof plans (multiple files supported)</p>
                {files.length > 0 && (
                  <div className="mt-4 w-full max-w-md space-y-2 text-left p-2">
                    {files.map((f, index) => (
                      <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-200">
                        <div className="flex items-center text-green-600 overflow-hidden">
                          <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{f.name}</span>
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); removeFile(index); }}
                          className="text-red-500 hover:text-red-700 ml-2 p-1 flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input type="file" className="hidden" accept=".pdf" multiple onChange={handleFileUpload} />
            </label>
          </div>
          
          <div className="mt-6">
            <h2 className="text-xl font-bold text-gray-800 mb-1">Step 2: Add Context Documents (Optional)</h2>
            <p className="text-sm text-gray-500 mb-4">Upload PDFs with legends, material codes, or specifications to improve accuracy.</p>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                {contextFiles.length > 0 && (
                    <div className="space-y-2 mb-4">
                        {contextFiles.map((f, index) => (
                            <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-200">
                                <div className="flex items-center text-indigo-600 overflow-hidden">
                                    <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
                                    <span className="text-sm font-medium truncate">{f.name}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.preventDefault(); removeContextFile(index); }}
                                    className="text-red-500 hover:text-red-700 ml-2 p-1 flex-shrink-0"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <label htmlFor="context-upload" className="flex items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 p-4 transition-colors">
                    <Upload className="w-6 h-6 mr-3 text-gray-400" />
                    <span className="text-sm text-gray-600 font-semibold">Upload Context Files</span>
                    <input type="file" id="context-upload" className="hidden" accept=".pdf" multiple onChange={handleContextFileUpload} />
                </label>
            </div>
          </div>


          {files.length > 0 && !processing && (
            <div className='mt-8'>
               <h2 className="text-xl font-bold text-gray-800 mb-1">Step 3: Analyze</h2>
               <p className="text-sm text-gray-500 mb-4">Configure and start the analysis.</p>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <label className="flex items-center cursor-pointer">
                  <input type="checkbox" checked={contextMode} onChange={(e) => setContextMode(e.target.checked)} className="mr-3 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"/>
                  <div>
                    <span className="font-semibold text-gray-800">Context-Aware Analysis</span>
                    <p className="text-sm text-gray-600 mt-1">Share information between plan analyses. Useful for separate legend/spec and floor plan files.</p>
                  </div>
                </label>
              </div>
              <button onClick={analyzePDFs} className="mt-4 w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:bg-indigo-300 disabled:cursor-not-allowed" disabled={processing}>
                <FileText className="w-5 h-5 mr-2" />
                Analyze {files.length} Roof Plan{files.length > 1 ? 's' : ''}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {processing && (
            <div className="mt-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-center mb-3">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin mr-3" />
                <span className="text-blue-800 font-medium">Processing...</span>
              </div>
              <p className="text-center text-blue-600 text-sm">{analysisStage}</p>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="space-y-6">
            {consolidatedSummary && (
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg shadow-xl p-6 sm:p-8 text-white">
                <div className="flex items-center mb-6">
                  <Building2 className="w-10 h-10 mr-4" />
                  <h2 className="text-3xl font-bold">Building Roof Summary</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
                  {[
                    { label: "Total Roof Area", value: `${consolidatedSummary.totalArea.toFixed(2)} m²` },
                    { label: "Unique Materials", value: consolidatedSummary.materials.length },
                    { label: "Roof Plans", value: consolidatedSummary.roofPlanCount },
                    { label: "Total PDFs", value: consolidatedSummary.totalPlanCount },
                  ].map(item => (
                    <div key={item.label} className="bg-white bg-opacity-20 backdrop-blur-sm p-4 rounded-lg">
                      <p className="text-sm text-indigo-100 mb-1">{item.label}</p>
                      <p className="text-2xl sm:text-3xl font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-lg p-6 text-gray-800">
                  <h3 className="text-xl font-bold mb-4 flex items-center">
                    <CheckCircle className="w-6 h-6 mr-2 text-green-500" />
                    Consolidated Material Quantities
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Code</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Material</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Total Area</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Confidence</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Found In</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consolidatedSummary.materials.map((material, index) => (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3"><span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded font-mono text-sm font-semibold">{material.code || '-'}</span></td>
                            <td className="px-4 py-3 font-medium">{material.material}</td>
                            <td className="px-4 py-3"><span className="font-semibold">{material.area.toFixed(2)}</span> {material.unit}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center"><div className="w-20 bg-gray-200 rounded-full h-2 mr-2"><div className={`h-2 rounded-full ${material.confidence >= 0.7 ? 'bg-green-500' : material.confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${material.confidence * 100}%` }}></div></div><span className="text-sm">{(material.confidence * 100).toFixed(0)}%</span></div>
                            </td>
                            <td className="px-4 py-3"><div className="flex items-center"><FileText className="w-4 h-4 mr-1 text-gray-400" /><span className="text-sm text-gray-600">{material.sources.length} plan{material.sources.length > 1 ? 's' : ''}</span></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Individual Plan Details</h2>
                <div className="flex gap-3">
                  <button onClick={exportToJSON} className="bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center"><Download className="w-4 h-4 mr-2" />JSON</button>
                  <button onClick={exportToCSV} className="bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center"><Download className="w-4 h-4 mr-2" />CSV</button>
                </div>
              </div>
              {results.map((result, resultIndex) => (
                <div key={resultIndex} className={`rounded-lg shadow-lg p-6 sm:p-8 ${result.isRoofRelated ? 'bg-white' : 'bg-gray-50 border-2 border-gray-300'}`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
                    <div className="flex-1 mb-4 sm:mb-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-gray-800 break-all">{result.fileName}</h3>
                        {result.isRoofRelated ? (<span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold whitespace-nowrap">✓ Roof Plan</span>) : (<span className="px-3 py-1 bg-gray-200 text-gray-600 rounded-full text-sm font-semibold whitespace-nowrap">✗ Not Roof Related</span>)}
                        {result.language && (<span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{result.language}</span>)}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{result.documentType} • Plan {resultIndex + 1} of {results.length}</p>
                    </div>
                  </div>
                  {!result.isRoofRelated ? (<div className="p-4 bg-gray-100 rounded-lg"><p className="text-gray-600">This document does not contain roof-related information and was excluded from the building summary.</p></div>) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg"><p className="text-sm text-gray-600 mb-1">Drawing Scale</p><p className="text-2xl font-bold text-gray-800">{result.scale}</p></div>
                        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg"><p className="text-sm text-gray-600 mb-1">Total Area</p><p className="text-2xl font-bold text-gray-800">{result.summary?.totalArea?.toFixed(2)} m²</p></div>
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg"><p className="text-sm text-gray-600 mb-1">Materials Found</p><p className="text-2xl font-bold text-gray-800">{result.summary?.materialCount || result.materials?.length || 0}</p></div>
                      </div>
                      {result.materials && result.materials.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead><tr className="bg-gray-50 border-b-2 border-gray-200"><th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Code</th><th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Material</th><th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Area</th><th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Confidence</th><th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Notes</th></tr></thead>
                            <tbody>
                              {result.materials.map((material, index) => (
                                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="px-4 py-3"><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-mono text-xs font-semibold">{material.code || '-'}</span></td>
                                  <td className="px-4 py-3 text-gray-800 font-medium">{material.material}</td>
                                  <td className="px-4 py-3 text-gray-700">{material.area} {material.unit}</td>
                                  <td className="px-4 py-3"><div className="flex items-center"><div className="w-full bg-gray-200 rounded-full h-2 mr-2"><div className={`h-2 rounded-full ${material.confidence >= 0.7 ? 'bg-green-500' : material.confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${material.confidence * 100}%` }}></div></div><span className="text-sm text-gray-600">{(material.confidence * 100).toFixed(0)}%</span></div></td>
                                  <td className="px-4 py-3 text-gray-600 text-sm">{material.notes}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
