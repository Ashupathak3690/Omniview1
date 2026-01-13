import React, { useState, useEffect, useRef } from 'react';

interface BrowserGridProps {
    url: string;
    count: number;
}

interface FrameData {
    id: number;
    currentUrl: string;
    key: number;
    isLocked: boolean;
    status: 'idle' | 'scheduled' | 'active';
    sessionId: string; // Unique ID for this frame's "user"
}

const BrowserGrid: React.FC<BrowserGridProps> = ({ url: masterUrl, count }) => {
    const [frames, setFrames] = useState<FrameData[]>([]);
    const [scale, setScale] = useState(0.75); 
    const [isSyncing, setIsSyncing] = useState(true);
    
    // "Ghost Mode" bundles multiple isolation features
    const [ghostMode, setGhostMode] = useState(false); 
    
    const [loadingDelay, setLoadingDelay] = useState(800);
    
    // Refs
    const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

    // Generate a random session ID (pseudo-UUID)
    const generateSessionId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Initialize frames
    useEffect(() => {
        setFrames(Array(count).fill(null).map((_, i) => ({
            id: i,
            currentUrl: '',
            key: 0,
            isLocked: false,
            status: 'idle',
            sessionId: generateSessionId() // Assign distinct identity on creation
        })));
        return () => clearTimeouts();
    }, [count]);

    const clearTimeouts = () => {
        timeoutsRef.current.forEach(t => clearTimeout(t));
        timeoutsRef.current = [];
    };

    const scheduleFrames = (framesToSchedule: number[]) => {
        clearTimeouts();
        framesToSchedule.forEach((frameId, index) => {
            const timeout = setTimeout(() => {
                setFrames(prev => prev.map(f => {
                    if (f.id === frameId) {
                        return {
                            ...f,
                            status: 'active',
                            key: f.key + 1
                        };
                    }
                    return f;
                }));
            }, index * loadingDelay);
            timeoutsRef.current.push(timeout);
        });
    };

    useEffect(() => {
        if (isSyncing && masterUrl) {
            setFrames(prev => prev.map(f => {
                if (f.isLocked) return f;
                return { ...f, currentUrl: masterUrl, status: 'scheduled' };
            }));

            const unlockedIds = frames.filter(f => !f.isLocked).map(f => f.id);
            scheduleFrames(unlockedIds);
        } else if (!masterUrl) {
             setFrames(prev => prev.map(f => f.isLocked ? f : { ...f, currentUrl: '', status: 'idle' }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [masterUrl, isSyncing, loadingDelay]); 

    // Handle Ghost Mode Toggling
    useEffect(() => {
        if (ghostMode) {
            // When Ghost Mode activates, regenerate all session IDs to ensure freshness
            setFrames(prev => prev.map(f => ({ ...f, sessionId: generateSessionId(), key: f.key + 1 })));
        }
    }, [ghostMode]);

    const getDisplayUrl = (urlStr: string, sessionId: string) => {
        if (!urlStr) return '';
        let final = urlStr.trim();
        if (!final.startsWith('http://') && !final.startsWith('https://')) {
            final = `https://${final}`;
        }
        
        // If Ghost Mode is active, we append unique signatures
        if (ghostMode) {
            const separator = final.includes('?') ? '&' : '?';
            // _uid: Represents the "User ID" for this frame
            // _cb: Cache buster timestamp for this specific request
            final = `${final}${separator}_uid=${sessionId}&_cb=${Date.now()}`;
        }

        return final;
    };

    const handleRefresh = (id: number) => {
        setFrames(prev => prev.map(f => f.id === id ? { ...f, key: f.key + 1 } : f));
    };

    const handleRefreshAll = () => {
        const framesToRefresh = frames.filter(f => f.currentUrl && (!f.isLocked || f.status !== 'idle')).map(f => f.id);
        
        // In Ghost Mode, refresh means "New Session", so regenerate IDs
        if (ghostMode) {
             setFrames(prev => prev.map(f => ({...f, sessionId: generateSessionId()})));
        }

        setFrames(prev => prev.map(f => {
            if (framesToRefresh.includes(f.id)) {
                return { ...f, status: 'scheduled' };
            }
            return f;
        }));

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

    // Strict Sandbox Logic
    const getSandboxRules = () => {
        const base = "allow-scripts allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox allow-downloads";
        // In Ghost Mode, we strictly REMOVE 'allow-same-origin'
        // This forces the browser to treat the content as opaque/unique origin, preventing cookie access.
        return ghostMode ? base : `${base} allow-same-origin`;
    };

    return (
        <div className="flex flex-col h-full bg-slate-900/50">
            {/* Toolbar */}
            <div className={`flex flex-col border-b sticky top-0 z-30 shadow-md transition-colors duration-500 ${ghostMode ? 'bg-slate-950 border-purple-900/50' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex flex-wrap items-center gap-4 p-4">
                    <div className="flex items-center space-x-2">
                        <span className={`text-xs font-bold uppercase tracking-wider ${ghostMode ? 'text-purple-400' : 'text-slate-400'}`}>
                            {ghostMode ? 'Ghost Ops' : 'Grid Controls'}
                        </span>
                    </div>
                    
                    <div className="h-6 w-px bg-slate-700 mx-2 hidden sm:block"></div>

                    <button 
                        onClick={handleRefreshAll}
                        className={`flex items-center space-x-1 px-3 py-1.5 text-white rounded text-sm transition-colors shadow-sm active:transform active:scale-95 ${
                            ghostMode ? 'bg-purple-700 hover:bg-purple-600' : 'bg-indigo-600 hover:bg-indigo-500'
                        }`}
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

                    <div className="flex items-center space-x-2 bg-slate-800 rounded px-3 py-1.5 border border-slate-700" title="Delay between loading each browser">
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

                    {/* Ghost Mode Toggle */}
                    <button 
                        onClick={() => setGhostMode(!ghostMode)}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded border transition-all duration-300 group ${
                            ghostMode 
                            ? 'bg-purple-900/40 border-purple-500 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.3)]' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                        title="Enable Unique Visitor Simulation (No Cookies + Unique IDs)"
                    >
                         <div className={`relative w-4 h-4 flex items-center justify-center`}>
                             <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 transition-all ${ghostMode ? 'text-purple-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {ghostMode && <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                            </span>}
                         </div>
                         <span className="text-sm font-medium">Ghost Mode</span>
                    </button>

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
                
                {/* Ghost Mode Explainer Banner */}
                {ghostMode && (
                    <div className="bg-purple-900/20 border-t border-purple-900/50 py-1 px-4 flex justify-center items-center space-x-3 text-xs text-purple-200">
                        <span className="font-bold tracking-wide">UNIQUE VISITOR SIMULATION ACTIVE:</span>
                        <span className="opacity-75">Cookies Disabled</span>
                        <span className="w-1 h-1 bg-purple-500 rounded-full"></span>
                        <span className="opacity-75">Cache Disabled</span>
                        <span className="w-1 h-1 bg-purple-500 rounded-full"></span>
                        <span className="opacity-75">Unique URL Signatures</span>
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
                                ${frame.isLocked ? 'border-orange-500/50 shadow-orange-500/10' : 
                                  ghostMode ? 'border-purple-800/30 hover:border-purple-500/50' : 'border-slate-700 hover:border-sky-500/50'}
                            `}
                            style={{ height: '340px' }}
                        >
                            {/* Frame Header */}
                            <div className="flex items-center p-2 bg-slate-900 border-b border-slate-700 space-x-2">
                                <div className="flex items-center space-x-1.5 mr-1">
                                    <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                                        frame.isLocked ? 'bg-orange-500' : 
                                        frame.status === 'active' ? (ghostMode ? 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.4)]' : 'bg-emerald-500') : 
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
                                            : ghostMode
                                                ? 'border-slate-700 text-purple-200 focus:border-purple-500 focus:ring-purple-500/20 placeholder-purple-800'
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
                                    title="Refresh Frame (New Session ID)"
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
                                            key={`${frame.key}-${ghostMode ? 'gm' : 'std'}-${frame.sessionId}`}
                                            src={getDisplayUrl(frame.currentUrl, frame.sessionId)}
                                            title={`Browser ${frame.id}`}
                                            className="w-full h-full border-0"
                                            sandbox={getSandboxRules()}
                                            referrerPolicy="no-referrer"
                                            loading="eager" 
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 bg-slate-50 transition-colors duration-300">
                                        {frame.status === 'scheduled' ? (
                                            <div className="flex flex-col items-center">
                                                 <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3 ${ghostMode ? 'border-purple-200 border-t-purple-600' : 'border-indigo-200 border-t-indigo-600'}`}></div>
                                                 <span className={`text-xs font-mono font-medium ${ghostMode ? 'text-purple-600' : 'text-indigo-600'}`}>
                                                    {ghostMode ? 'Ghosting...' : 'Loading...'}
                                                 </span>
                                                 <span className="text-[10px] text-slate-400 mt-1">
                                                    {ghostMode ? 'Creating Identity' : 'Waiting for slot'}
                                                 </span>
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
                                    <span className={`text-[9px] font-mono uppercase ${frame.status === 'active' ? (ghostMode ? 'text-purple-400' : 'text-emerald-400') : 'text-slate-600'}`}>
                                        {frame.status}
                                    </span>
                                </div>
                                {ghostMode && (
                                    <div className="flex items-center space-x-2">
                                        <span className="text-[9px] text-purple-600/70 font-mono flex items-center" title="Unique User Identity Assigned">
                                            ID: {frame.sessionId.substring(0,6)}...
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                
                {(!masterUrl && frames.every(f => !f.currentUrl)) && (
                    <div className="mt-8 text-center animate-fade-in">
                        <p className="text-slate-500 text-sm">
                            Ready. Enable <span className="text-purple-400 font-bold">Ghost Mode</span> to simulate unique users.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BrowserGrid;