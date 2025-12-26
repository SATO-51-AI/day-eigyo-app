
import React, { useState, useMemo, useRef } from 'react';
import { Facility } from './types';
import { parseContentToFacilities, optimizeRoute } from './geminiService';
import { 
  MapPin, Navigation, CheckCircle2, AlertCircle, Copy, Upload, X, Loader2, Calendar, 
  Image as ImageIcon, Trash2, LocateFixed, ListChecks, ClipboardList, CheckSquare, Square, 
  Zap, MousePointer2, ExternalLink, Car, LayoutGrid
} from 'lucide-react';

const App: React.FC = () => {
  const [ocrText, setOcrText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [currentLocation, setCurrentLocation] = useState('現在地');
  const [optimizedIds, setOptimizedIds] = useState<string[]>([]);
  const [reasoning, setReasoning] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showUnvisitedOnly, setShowUnvisitedOnly] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMonth = new Date().getMonth() + 1;

  // 日付文字列から「月」を抽出する関数（精度向上）
  const getMonthFromDateString = (dateStr: string | undefined): number | null => {
    if (!dateStr || dateStr === 'なし' || dateStr === '未訪問') return null;
    // "3月", "03/12", "2024-03", "3.12" 等に対応
    const match = dateStr.match(/(\d{1,2})[月\/\-\.]/);
    if (match) return parseInt(match[1], 10);
    // 数字のみの場合 (例: "3")
    const pureNum = dateStr.match(/^\d{1,2}$/);
    if (pureNum) return parseInt(pureNum[0], 10);
    return null;
  };

  // ステータス別の施設分類
  const sortedStats = useMemo(() => {
    const visited: Facility[] = [];
    const unvisited: Facility[] = [];
    
    facilities.forEach(f => {
      const visitMonth = getMonthFromDateString(f.lastVisitDate);
      if (visitMonth === currentMonth) {
        visited.push(f);
      } else {
        unvisited.push(f);
      }
    });
    
    return { visited, unvisited, total: facilities.length };
  }, [facilities, currentMonth]);

  const displayedFacilities = showUnvisitedOnly ? sortedStats.unvisited : facilities;

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      if (newSet.size >= 9) return alert("最大9件までです。");
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectTop9 = () => setSelectedIds(new Set(sortedStats.unvisited.slice(0, 9).map(f => f.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const getPos = () => {
    if (!navigator.geolocation) return alert("GPS不可");
    setLoadingMessage("現在地取得中...");
    navigator.geolocation.getCurrentPosition(
      p => { setCurrentLocation(`${p.coords.latitude},${p.coords.longitude}`); setLoadingMessage(""); },
      () => { alert("取得失敗"); setLoadingMessage(""); }
    );
  };

  const handleParse = async () => {
    setLoading(true);
    setLoadingMessage("スキャン中...");
    setError(null);
    try {
      const inputs: (string | { data: string; mimeType: string })[] = [];
      for (const file of selectedFiles) {
        const base64 = await new Promise<string>(r => {
          const rd = new FileReader();
          rd.onload = () => r((rd.result as string).split(',')[1]);
          rd.readAsDataURL(file);
        });
        inputs.push({ data: base64, mimeType: file.type });
      }
      if (ocrText.trim()) inputs.push(ocrText);
      if (inputs.length === 0) throw new Error("資料がありません。");
      const data = await parseContentToFacilities(inputs);
      setFacilities(data);
      setSelectedIds(new Set());
    } catch (e) { setError("スキャンに失敗しました。"); } finally { setLoading(false); setLoadingMessage(""); }
  };

  const handleOptimize = async (mode: 'auto' | 'manual') => {
    const targets = mode === 'manual' ? sortedStats.unvisited.filter(f => selectedIds.has(f.id)) : sortedStats.unvisited;
    if (targets.length === 0) return alert("対象がありません。");
    setLoading(true);
    setLoadingMessage("最短ルート計算中...");
    try {
      const res = await optimizeRoute(targets, currentLocation, 480);
      setOptimizedIds(res.orderedIds);
      setReasoning(res.reasoning);
    } catch (e) { setError("ルート作成に失敗しました。"); } finally { setLoading(false); setLoadingMessage(""); }
  };

  const copyToClip = (text: string) => { navigator.clipboard.writeText(text); alert("コピーしました"); };

  const getMapsUrl = () => {
    const ordered = optimizedIds.map(id => facilities.find(f => f.id === id)).filter(Boolean);
    if (ordered.length === 0) return "";
    const origin = encodeURIComponent(currentLocation);
    const dest = encodeURIComponent(ordered[ordered.length - 1]!.address);
    const wps = ordered.slice(0, -1).map(f => encodeURIComponent(f!.address)).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${wps}&travelmode=driving`;
  };

  return (
    <div className="min-h-screen pb-40 bg-slate-50 selection:bg-indigo-100">
      <header className="bg-white/90 backdrop-blur-xl border-b sticky top-0 z-20 px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg">
              <Navigation className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 leading-none">Care-Route Pro</h1>
              <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-1">Driving Efficiency Optimizer</p>
            </div>
          </div>
          {facilities.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex bg-slate-100 px-3 py-1.5 rounded-full border text-[11px] font-bold text-slate-600 gap-3">
                <span className="flex items-center gap-1"><LayoutGrid size={12} className="text-slate-400"/>全 {sortedStats.total}</span>
                <span className="flex items-center gap-1 text-orange-600"><AlertCircle size={12}/>未 {sortedStats.unvisited.length}</span>
                <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12}/>済 {sortedStats.visited.length}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {facilities.length === 0 ? (
          <section className="space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-black text-slate-900">訪問ルート作成</h2>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">今月まだ訪問していない施設を自動検出し、最短ルートを提案します。</p>
            </div>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-[2.5rem] p-12 flex flex-col items-center gap-5 bg-white hover:border-indigo-400 cursor-pointer transition-all"
            >
              <input type="file" ref={fileInputRef} onChange={e => e.target.files && setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)])} className="hidden" accept="image/*,application/pdf" multiple />
              <div className="bg-indigo-50 p-6 rounded-full text-indigo-600"><Upload className="w-10 h-10" /></div>
              <div className="text-center">
                <p className="font-black text-slate-700">訪問記録をアップロード</p>
                <p className="text-slate-400 text-xs mt-1">PDF・写真から施設データを自動抽出</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="bg-indigo-600 text-white text-[10px] font-black px-3 py-2 rounded-xl flex items-center gap-2">
                    <ImageIcon className="w-3 h-3" /> {f.name.slice(0,8)}...
                    <X className="w-3.5 h-3.5 cursor-pointer" onClick={e => { e.stopPropagation(); setSelectedFiles(prev => prev.filter((_, j) => i !== j)); }} />
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleParse} disabled={loading || (selectedFiles.length === 0)} className="w-full bg-slate-900 text-white font-black py-5 rounded-[1.5rem] disabled:opacity-50 shadow-xl shadow-slate-200">
              {loading ? <Loader2 className="animate-spin mx-auto" /> : "AIスキャンを開始"}
            </button>
          </section>
        ) : (
          <section className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
            {/* 統計ダッシュボード */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-slate-800 flex items-center gap-3"><Calendar className="w-5 h-5 text-indigo-600" /> {currentMonth}月の訪問状況</h3>
                  <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button onClick={() => setShowUnvisitedOnly(true)} className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${showUnvisitedOnly ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>未訪問 ({sortedStats.unvisited.length})</button>
                    <button onClick={() => setShowUnvisitedOnly(false)} className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${!showUnvisitedOnly ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>全て ({sortedStats.total})</button>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] font-black text-slate-400 mb-2">
                       <span>進捗率</span>
                       <span>{Math.round((sortedStats.visited.length / sortedStats.total) * 100)}%</span>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${(sortedStats.visited.length / sortedStats.total) * 100}%` }}></div>
                    </div>
                  </div>
                  <button onClick={() => copyToClip(sortedStats.unvisited.map(f => f.name).join('\n'))} className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 hover:bg-indigo-100 transition-all"><ClipboardList /></button>
                </div>
              </div>
              <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white flex flex-col justify-between shadow-lg shadow-indigo-100">
                <h4 className="font-bold text-xs uppercase tracking-widest text-indigo-200">Route Origin</h4>
                <div className="flex items-center gap-2 mt-4">
                  <div className="flex-1 bg-white/10 rounded-xl px-4 py-2 text-xs flex items-center gap-2 border border-white/20">
                    <MapPin className="w-3 h-3" /><input type="text" value={currentLocation} onChange={e => setCurrentLocation(e.target.value)} className="bg-transparent focus:outline-none w-full placeholder-indigo-300" placeholder="現在地" />
                  </div>
                  <button onClick={getPos} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all border border-white/20"><LocateFixed className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            {/* リスト表示 */}
            <div className="space-y-4">
              <div className="flex justify-between px-2 items-end">
                <h3 className="font-black text-slate-800 text-xl flex items-center gap-2"><ListChecks className="text-indigo-600" /> {showUnvisitedOnly ? '未訪問施設' : '全件リスト'}</h3>
                {showUnvisitedOnly && (
                  <div className="flex gap-2">
                    <button onClick={selectTop9} className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all">上位9件選択</button>
                    <button onClick={clearSelection} className="text-[10px] font-black bg-slate-100 text-slate-400 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all">全解除</button>
                  </div>
                )}
              </div>
              
              {displayedFacilities.length === 0 ? (
                <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center text-slate-400 font-bold">
                  表示する施設がありません
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {displayedFacilities.map(f => {
                    const isV = getMonthFromDateString(f.lastVisitDate) === currentMonth;
                    const isS = selectedIds.has(f.id);
                    return (
                      <div key={f.id} onClick={() => !isV && toggleSelection(f.id)} className={`bg-white p-6 rounded-[2rem] border transition-all flex items-start gap-4 cursor-pointer ${isV ? 'opacity-40 grayscale bg-slate-50 border-slate-200 cursor-default' : isS ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-md' : 'hover:border-indigo-200 shadow-sm border-slate-100'}`}>
                        <div className={`p-4 rounded-2xl shrink-0 ${isV ? 'bg-slate-200 text-slate-500' : isS ? 'bg-indigo-600 text-white shadow-lg' : 'bg-orange-50 text-orange-500'}`}>
                          {isV ? <CheckCircle2 /> : isS ? <CheckSquare /> : <Square />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-slate-800 truncate leading-tight">{f.name}</h4>
                          <p className="text-xs text-slate-400 truncate mt-1">{f.address}</p>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                            <span className={`text-[9px] font-black px-2 py-1 rounded-md ${isV ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                              {isV ? '訪問済み' : '未訪問'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">最終: {f.lastVisitDate || 'なし'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ルート結果モーダル */}
            {optimizedIds.length > 0 && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                  <div className="p-8 border-b flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h2 className="text-2xl font-black flex items-center gap-2"><Car className="text-indigo-600" /> 最短巡回ルート</h2>
                      <p className="text-[10px] text-indigo-500 font-bold uppercase mt-1">Driving Distance Optimized</p>
                    </div>
                    <button onClick={() => setOptimizedIds([])} className="p-3 bg-white shadow-sm border rounded-2xl text-slate-400 hover:text-red-500 transition-all"><X /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {reasoning && <div className="bg-indigo-600 p-5 rounded-2xl text-white text-sm font-bold flex gap-4 shadow-lg">💡 {reasoning}</div>}
                    <div className="space-y-4">
                      {optimizedIds.map((id, idx) => {
                        const f = facilities.find(fac => fac.id === id);
                        if (!f) return null;
                        return (
                          <div key={id} className="flex gap-4 items-start group">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-black shadow-lg">{idx + 1}</div>
                              {idx < optimizedIds.length - 1 && <div className="w-0.5 h-12 bg-slate-100 rounded-full"></div>}
                            </div>
                            <div className="flex-1 bg-white p-4 rounded-2xl border group-hover:border-indigo-200 transition-all">
                              <h5 className="font-black text-slate-900 text-sm">{f.name}</h5>
                              <div className="flex justify-between items-center mt-2">
                                <p className="text-[11px] text-indigo-500 font-bold truncate select-all">{f.address}</p>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => copyToClip(f.address)} className="p-2 bg-slate-50 rounded-lg hover:bg-indigo-50 transition-all"><Copy size={14} /></button>
                                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address)}`} target="_blank" rel="noreferrer" className="p-2 bg-slate-50 rounded-lg hover:bg-indigo-50 transition-all"><ExternalLink size={14} /></a>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="p-8 bg-slate-50 border-t space-y-4">
                    <a href={getMapsUrl()} target="_blank" rel="noreferrer" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:bg-indigo-600 transition-all">
                      <Navigation className="text-indigo-400" /> Googleマップでルート開始
                    </a>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center pt-8">
              <button onClick={() => { setFacilities([]); setOptimizedIds([]); setSelectedIds(new Set()); setSelectedFiles([]); setError(null); }} className="text-xs font-black text-slate-300 hover:text-red-500 flex items-center gap-2 uppercase tracking-widest transition-all"><Trash2 size={16} /> 全データをリセット</button>
            </div>
          </section>
        )}
      </main>

      {/* フローティングアクションバー */}
      {facilities.length > 0 && optimizedIds.length === 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl bg-white rounded-[2.5rem] p-3 shadow-2xl border flex flex-col sm:flex-row items-center gap-3 z-30 animate-in slide-in-from-bottom-10">
           <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl w-full sm:w-auto shrink-0">
             <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Car size={16} /></div>
             <div className="leading-tight"><p className="text-[10px] font-black text-slate-400 uppercase">選択中</p><p className="text-sm font-black text-slate-700">{selectedIds.size}件</p></div>
           </div>
           <div className="flex flex-1 w-full gap-2">
             <button onClick={() => handleOptimize('auto')} disabled={loading || sortedStats.unvisited.length === 0} className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-sm hover:bg-indigo-600 transition-all disabled:opacity-30">
               {loading ? <Loader2 className="animate-spin" /> : <Zap size={16} className="text-yellow-400" />} <span>AIお任せ</span>
             </button>
             <button onClick={() => handleOptimize('manual')} disabled={loading || selectedIds.size === 0} className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-sm disabled:opacity-30 hover:bg-indigo-500 transition-all">
               {loading ? <Loader2 className="animate-spin" /> : <MousePointer2 size={16} />} <span>選択分を最適化</span>
             </button>
           </div>
        </div>
      )}

      {error && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-red-500 text-white p-5 rounded-[2rem] flex items-center gap-4 z-[100] shadow-2xl animate-in slide-in-from-top-10">
          <AlertCircle className="shrink-0" /><p className="text-sm font-black">{error}</p><X className="ml-auto cursor-pointer bg-white/20 rounded-full p-1" onClick={() => setError(null)} />
        </div>
      )}
    </div>
  );
};

export default App;
