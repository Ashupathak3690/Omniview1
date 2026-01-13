import React, { useState, useEffect, useRef } from 'react';

interface BrowserGridProps {
    url: string;
    count: number;
}

interface FrameData {
    id: number;
    currentUrl: string;
    key: number; // Used to force iframe reload
    isLocked: boolean; // If true, doesn't sync with master URL
    status: 'idle' | 'scheduled' | 'active'; // Track loading state
}

const BrowserGrid: React.FC<BrowserGridProps> = ({ url: masterUrl, count }) => {
    const [frames, setFrames] = useState<FrameData[]>([]);
    const [scale, setScale] = useState(0.75); 
    const [isSyncing, setIsSyncing] = useState(true);
    const [isStateless, setIsStateless] = useState(false); // Strict Sandbox Mode
    const [isCacheBust, setIsCacheBust] = useState(false); // Cache busting
    const [loadingDelay, setLoadingDelay] = useState(800); // ms between loads
    
    // Refs to manage timeouts preventing memory leaks
    const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

    // Initialize frames
    useEffect(() => {
        setFrames(Array(count).fill(null).map((_, i) => ({
            id: i,
            currentUrl: '',
            key: 0,
            isLocked: false,
            status: 'idle'
        })));
        return () => clearTimeouts();
    }, [count]);

    const clearTimeouts = () => {
        timeoutsRef.current.forEach(t => clearTimeout(t));
        timeoutsRef.current = [];
    };

    // Helper to schedule frames sequentially
    const scheduleFrames = (framesToSchedule: number[]) => {
        clearTimeouts();
        
        framesToSchedule.forEach((frameId, index) => {
            const timeout = setTimeout(() => {
                setFrames(prev => prev.map(f => {
                    if (f.id === frameId) {
                        return {
                            ...f,
                            status: 'active',
                            key: f.key + 1 // Force reload
                        };
                    }
                    return f;
                }));
            }, index * loadingDelay);
            timeoutsRef.current.push(timeout);
        });
    };

    // Effect for Master URL changes
    useEffect(() => {
        if (isSyncing && masterUrl) {
            // 1. Set all relevant frames to scheduled state immediately
            setFrames(prev => prev.map(f => {
                if (f.isLocked) return f;
                return { ...f, currentUrl: masterUrl, status: 'scheduled' };
            }));

            // 2. Trigger the sequencer
            const unlockedIds = frames.filter(f => !f.isLocked).map(f => f.id);
            // We use a slight delay to ensure state update #1 has processed or simply call sequencer
            // But we can't access updated 'frames' state inside this effect immediately if we used it directly.
            // Using IDs is safer.
            scheduleFrames(unlockedIds);
        } else if (!masterUrl) {
            // Reset if empty
             setFrames(prev => prev.map(f => f.isLocked ? f : { ...f, currentUrl: '', status: 'idle' }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [masterUrl, isSyncing, loadingDelay]); 

    const getDisplayUrl = (urlStr: string) => {
        if (!urlStr) return '';
        let final = urlStr.trim();
        if (!final.startsWith('http://') && !final.startsWith('https://')) {
            final = `https://${final}`;
        }
        
        if (isCacheBust) {
            const separator = final.includes('?') ? '&' : '?';
            final = `${final}${separator}_cb=${Date.now()}`;
        }

        return final;
    };

    const handleRefresh = (id: number) => {
        setFrames(prev => prev.map(f => f.id === id ? { ...f, key: f.key + 1 } : f));
    };

    const handleRefreshAll = () => {
        // 1. Set all active/unlocked frames to scheduled
        const framesToRefresh = frames.filter(f => f.currentUrl && (!f.isLocked || f.status !== 'idle')).map(f => f.id);
        
        setFrames(prev => prev.map(f => {
            if (framesToRefresh.includes(f.id)) {
                return { ...f, status: 'scheduled' };
            }
            return f;
        }));

        // 2. Schedule them
        scheduleFrames(framesToRefresh);
    };

    const handleUrlChange = (id: number, newUrl: string) => {
        setFrames(prev => prev.map(f => f.id === id ? { 
            ...f, 
            currentUrl: newUrl, 
            isLocked: true,
            status: 'active' 
        } : f));
    };

    const toggleLock = (id: number) => {
        setFrames(prev => prev.map(f => f.id === id ? { ...f, isLocked: !f.isLocked } : f));
    };

    // Strict Mode: Removes 'allow-same-origin' to prevent cookie sharing
    const getSandboxRules = () => {
        const base = "allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox allow-downloads";
        return isStateless ? base : `${base} allow-same-origin`;
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
                        className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm transition-colors shadow-sm active:transform active:scale-95"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Refresh All (Seq)</span>
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

                    {/* Sequential Delay Control */}
                    <div className="flex items-center space-x-2 bg-slate-800 rounded px-3 py-1.5 border border-slate-700" title="Delay between loading each browser to prevent rate limiting">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <select 
                            value={loadingDelay}
                            onChange={(e) => setLoadingDelay(Number(e.target.value))}
                            className="bg-transparent text-sm text-slate-300 border-none focus:ring-0 cursor-pointer py-0 pl-0 pr-6"
                        >
                            <option value={200}>Fast (0.2s)</option>
                            <option value={800}>Normal (0.8s)</option>
                            <option value={2000}>Slow (2s)</option>
                            <option value={5000}>Safe (5s)</option>
                        </select>
                    </div>

                    <div className="h-6 w-px bg-slate-700 mx-2 hidden sm:block"></div>

                    {/* Stateless Mode Toggle */}
                    <div 
                        className={`flex items-center space-x-2 rounded px-3 py-1.5 border transition-all cursor-pointer select-none ${isStateless ? 'bg-pink-900/30 border-pink-700/50' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                        onClick={() => setIsStateless(!isStateless)}
                        title="Stateless mode prevents cookies/session sharing between tabs"
                    >
                         <div className={`w-3 h-3 rounded-full transition-colors ${isStateless ? 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'bg-slate-500'}`}></div>
                         <span className={`text-xs font-medium ${isStateless ? 'text-pink-200' : 'text-slate-300'}`}>
                            {isStateless ? 'Stateless' : 'Standard'}
                         </span>
                    </div>

                    {/* Cache Bust Toggle */}
                    <div 
                        className={`flex items-center space-x-2 rounded px-3 py-1.5 border transition-all cursor-pointer select-none ${isCacheBust ? 'bg-emerald-900/30 border-emerald-700/50' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                        onClick={() => setIsCacheBust(!isCacheBust)}
                        title="Appends a timestamp to URLs to force fresh network requests"
                    >
                         <div className={`w-3 h-3 rounded-full transition-colors ${isCacheBust ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`}></div>
                         <span className={`text-xs font-medium ${isCacheBust ? 'text-emerald-200' : 'text-slate-300'}`}>
                            {isCacheBust ? 'No Cache' : 'Cached'}
                         </span>
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
                                <div className="flex items-center space-x-1.5 mr-1">
                                    <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                                        frame.isLocked ? 'bg-orange-500' : 
                                        frame.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 
                                        frame.status === 'scheduled' ? 'bg-yellow-500 animate-pulse' :
                                        'bg-slate-600'
                                    }`}></div>
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
                                {frame.currentUrl && frame.status === 'active' ? (
                                    <div 
                                        className="absolute top-0 left-0 origin-top-left transition-transform duration-200 ease-out"
                                        style={{ 
                                            width: `${100 / scale}%`, 
                                            height: `${100 / scale}%`,
                                            transform: `scale(${scale})`
                                        }}
                                    >
                                        <iframe 
                                            key={`${frame.key}-${isStateless ? 'sl' : 'st'}-${isCacheBust ? 'cb' : 'nc'}`}
                                            src={getDisplayUrl(frame.currentUrl)}
                                            title={`Browser ${frame.id}`}
                                            className="w-full h-full border-0"
                                            // Conditional Sandbox
                                            sandbox={getSandboxRules()}
                                            referrerPolicy="no-referrer"
                                            loading="eager" 
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 bg-slate-50 transition-colors duration-300">
                                        {frame.status === 'scheduled' ? (
                                            <div className="flex flex-col items-center">
                                                 <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                                                 <span className="text-xs font-mono text-indigo-600 font-medium">Scheduled...</span>
                                                 <span className="text-[10px] text-slate-400 mt-1">Waiting for slot</span>
                                            </div>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-20 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                                </svg>
                                                <span className="text-xs opacity-50 text-center font-medium text-slate-500">Waiting for Input</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {/* Status Footer */}
                            <div className="bg-slate-900 border-t border-slate-800 px-2 py-1 flex justify-between items-center h-6">
                                <div className="flex items-center space-x-2">
                                    <span className={`text-[9px] font-mono uppercase ${frame.status === 'active' ? 'text-emerald-400' : 'text-slate-600'}`}>
                                        {frame.status}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {isCacheBust && (
                                        <span className="text-[9px] text-emerald-600/70 font-mono" title="Cache Bust Active">
                                            BUST
                                        </span>
                                    )}
                                    {isStateless && (
                                        <span className="text-[9px] text-pink-600/70 font-mono" title="Stateless Mode Active">
                                            NO-COOKIES
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                
                {(!masterUrl && frames.every(f => !f.currentUrl)) && (
                    <div className="mt-8 text-center animate-fade-in">
                        <p className="text-slate-500 text-sm">
                            Ready to browse. Enter a URL above to start the grid.
                        </p>
                        <p className="text-slate-600 text-xs mt-2">
                            Note: Some major sites (Google, YouTube) may block embedded views.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BrowserGrid;