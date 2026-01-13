import React, { useState, useEffect } from 'react';

interface BrowserGridProps {
    url: string;
    count: number;
}

interface FrameData {
    id: number;
    currentUrl: string;
    key: number; // Used to force iframe reload
    isLocked: boolean; // If true, doesn't sync with master URL
}

const REGIONS = [
    { id: 'direct', name: 'Direct (My IP)', prefix: '' },
    { id: 'us', name: 'United States (via CORS Proxy)', prefix: 'https://corsproxy.io/?' },
    { id: 'custom', name: 'Custom / Private Proxy', prefix: '' }
];

const BrowserGrid: React.FC<BrowserGridProps> = ({ url: masterUrl, count }) => {
    const [frames, setFrames] = useState<FrameData[]>([]);
    const [scale, setScale] = useState(0.75); // Default scaled down for better visibility
    const [isSyncing, setIsSyncing] = useState(true);
    
    // Region / Proxy Settings
    const [selectedRegion, setSelectedRegion] = useState(REGIONS[0].id);
    const [customProxyPrefix, setCustomProxyPrefix] = useState('');

    // Initialize frames
    useEffect(() => {
        setFrames(Array(count).fill(null).map((_, i) => ({
            id: i,
            currentUrl: masterUrl || '',
            key: 0,
            isLocked: false
        })));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    // Sync with master URL
    useEffect(() => {
        if (isSyncing && masterUrl) {
            setFrames(prev => prev.map(f => 
                f.isLocked ? f : { ...f, currentUrl: masterUrl, key: f.key + 1 }
            ));
        }
    }, [masterUrl, isSyncing]);

    const getDisplayUrl = (urlStr: string) => {
        if (!urlStr) return '';
        let final = urlStr.trim();
        // Auto-prepend https if missing
        if (!final.startsWith('http://') && !final.startsWith('https://')) {
            final = `https://${final}`;
        }

        // Determine Prefix
        let prefix = '';
        if (selectedRegion === 'us') {
            prefix = REGIONS[1].prefix;
        } else if (selectedRegion === 'custom') {
            prefix = customProxyPrefix;
        }

        // Apply Prefix
        if (prefix) {
            final = `${prefix}${encodeURIComponent(final)}`;
        }
        
        return final;
    };

    const handleRefresh = (id: number) => {
        setFrames(prev => prev.map(f => f.id === id ? { ...f, key: f.key + 1 } : f));
    };

    const handleRefreshAll = () => {
        setFrames(prev => prev.map(f => ({ ...f, key: f.key + 1 })));
    };

    const handleUrlChange = (id: number, newUrl: string) => {
        setFrames(prev => prev.map(f => f.id === id ? { ...f, currentUrl: newUrl, isLocked: true } : f));
    };

    const toggleLock = (id: number) => {
        setFrames(prev => prev.map(f => f.id === id ? { ...f, isLocked: !f.isLocked } : f));
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/50">
            {/* Toolbar */}
            <div className="flex flex-col border-b border-slate-800 bg-slate-900 sticky top-0 z-30 shadow-md">
                <div className="flex flex-wrap items-center gap-4 p-4">
                    <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grid Controls</span>
                    </div>
                    
                    <div className="h-6 w-px bg-slate-700 mx-2 hidden sm:block"></div>

                    <button 
                        onClick={handleRefreshAll}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm transition-colors shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Refresh All</span>
                    </button>

                    <div className="flex items-center space-x-2 bg-slate-800 rounded px-3 py-1.5 border border-slate-700">
                        <input 
                            type="checkbox" 
                            id="syncToggle"
                            checked={isSyncing} 
                            onChange={(e) => setIsSyncing(e.target.checked)}
                            className="rounded border-slate-600 text-indigo-500 focus:ring-indigo-500 bg-slate-700 h-4 w-4"
                        />
                        <label htmlFor="syncToggle" className="text-sm text-slate-300 cursor-pointer select-none">Sync URLs</label>
                    </div>

                    {/* Region Selector */}
                    <div className="flex items-center space-x-2 bg-slate-800 rounded px-3 py-1 border border-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <select 
                            value={selectedRegion}
                            onChange={(e) => setSelectedRegion(e.target.value)}
                            className="bg-transparent text-sm text-slate-300 border-none focus:ring-0 cursor-pointer py-1"
                        >
                            {REGIONS.map(region => (
                                <option key={region.id} value={region.id}>{region.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center space-x-2 ml-auto bg-slate-800 p-1.5 rounded border border-slate-700">
                        <span className="text-xs text-slate-400 pl-1">Zoom:</span>
                        <input 
                            type="range" 
                            min="0.25" 
                            max="1" 
                            step="0.05" 
                            value={scale} 
                            onChange={(e) => setScale(parseFloat(e.target.value))}
                            className="w-24 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <span className="text-xs w-8 text-right font-mono text-slate-400">{Math.round(scale * 100)}%</span>
                    </div>
                </div>

                {/* Custom Proxy Panel */}
                {selectedRegion === 'custom' && (
                    <div className="bg-slate-800/50 border-t border-slate-700 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="max-w-4xl">
                             <div className="flex flex-col md:flex-row gap-4 items-center">
                                <div className="flex-1 w-full">
                                    <label className="block text-xs text-slate-400 mb-1">Custom Web Proxy Prefix</label>
                                    <input 
                                        type="text" 
                                        value={customProxyPrefix}
                                        onChange={(e) => setCustomProxyPrefix(e.target.value)}
                                        placeholder="Enter proxy URL (e.g. https://my-us-proxy.com/?url=)"
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {frames.map((frame) => (
                        <div 
                            key={frame.id} 
                            className={`
                                flex flex-col bg-slate-800 rounded-lg overflow-hidden border shadow-lg transition-all duration-300
                                ${frame.isLocked ? 'border-orange-500/50 shadow-orange-500/10' : 'border-slate-700 hover:border-sky-500/50'}
                            `}
                            style={{ height: '340px' }}
                        >
                            {/* Frame Header */}
                            <div className="flex items-center p-2 bg-slate-900 border-b border-slate-700 space-x-2">
                                <div className="flex items-center space-x-1.5 mr-1" title={frame.isLocked ? "Locked: Independent" : "Active: Synced"}>
                                    <div className={`w-2 h-2 rounded-full ${frame.isLocked ? 'bg-orange-500' : 'bg-emerald-500'}`}></div>
                                </div>
                                
                                <span className="text-[10px] font-mono text-slate-500 select-none">#{frame.id + 1}</span>

                                <input 
                                    type="text" 
                                    value={frame.currentUrl}
                                    onChange={(e) => handleUrlChange(frame.id, e.target.value)}
                                    className={`
                                        flex-1 bg-slate-800 border text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 transition-colors truncate font-mono
                                        ${frame.isLocked 
                                            ? 'border-orange-500/30 text-orange-200 focus:border-orange-500 focus:ring-orange-500/20' 
                                            : 'border-slate-700 text-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20'}
                                    `}
                                    placeholder="Enter URL..."
                                />

                                <button 
                                    onClick={() => toggleLock(frame.id)}
                                    className={`p-1.5 rounded transition-colors ${frame.isLocked ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' : 'text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                                    title={frame.isLocked ? "Unlock (Enable Sync)" : "Lock (Disable Sync)"}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        {frame.isLocked 
                                            ? <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                            : <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 016 0z" />
                                        }
                                    </svg>
                                </button>
                                
                                <button 
                                    onClick={() => handleRefresh(frame.id)}
                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                    title="Refresh Frame"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>

                            {/* Iframe Container */}
                            <div className="flex-1 relative bg-white overflow-hidden group-hover:shadow-inner">
                                {frame.currentUrl ? (
                                    <div 
                                        className="absolute top-0 left-0 origin-top-left transition-transform duration-200 ease-out"
                                        style={{ 
                                            width: `${100 / scale}%`, 
                                            height: `${100 / scale}%`,
                                            transform: `scale(${scale})`
                                        }}
                                    >
                                        <iframe 
                                            key={frame.key}
                                            src={getDisplayUrl(frame.currentUrl)}
                                            title={`Browser ${frame.id}`}
                                            className="w-full h-full border-0"
                                            // More permissive sandbox settings to ensure functionality
                                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox allow-downloads"
                                            referrerPolicy="no-referrer"
                                            loading="lazy"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 bg-slate-50">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-20 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                        </svg>
                                        <span className="text-xs opacity-50 text-center font-medium text-slate-500">Waiting for URL</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Status Footer */}
                            <div className="bg-slate-900 border-t border-slate-800 px-2 py-1 flex justify-between items-center">
                                <span className="text-[9px] text-slate-600 font-mono uppercase">
                                    {frame.currentUrl ? 'Active' : 'Idle'}
                                </span>
                                {frame.currentUrl && selectedRegion !== 'direct' && (
                                    <span className="text-[9px] text-indigo-400 font-mono flex items-center">
                                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1"></span>
                                        {selectedRegion === 'us' ? 'US PROXY' : 'CUSTOM PROXY'}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                
                {(!masterUrl && frames.every(f => !f.currentUrl)) && (
                    <div className="mt-8 text-center">
                        <p className="text-slate-500 text-sm">
                            Tip: Try <span className="text-indigo-400 font-mono bg-slate-800 px-1 rounded">wikipedia.org</span> to test the grid.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BrowserGrid;