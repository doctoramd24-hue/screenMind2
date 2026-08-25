import React, { useMemo } from 'react';
import { useNotes } from '../contexts/NotesContext.tsx';
import { 
    Activity, 
    PieChart, 
    Calendar, 
    TrendingUp, 
    BookOpen, 
    CheckCircle2, 
    Clock, 
    Hash,
    Zap,
    BarChart,
    Target
} from 'lucide-react';
import { motion } from 'motion/react';
import { getTagColor } from '../utils/tagColors.ts';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const DashboardPage: React.FC = () => {
    const { notes, goals } = useNotes();
    const activeNotes = notes.filter(n => n.status !== 'trash');
    
    const stats = useMemo(() => {
        const total: number = activeNotes.length;
        const finished: number = activeNotes.filter(n => n.status === 'finished').length;
        const inWork: number = activeNotes.filter(n => n.status === 'in-work').length;
        
        const catCounts: Record<string, number> = {};
        activeNotes.forEach(n => {
            const cat: string = n.category || 'Uncategorized';
            catCounts[cat] = (catCounts[cat] || 0) + 1;
        });

        const dayActivity: Record<string, number> = {};
        activeNotes.forEach(n => {
            const date: string = new Date(n.createdAt).toLocaleDateString();
            dayActivity[date] = (dayActivity[date] || 0) + 1;
        });

        const chartData: { date: string, count: number }[] = Object.entries(dayActivity)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-7);

        return { total, finished, inWork, catCounts, chartData };
    }, [activeNotes]);

    return (
        <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-12">
            <header className="flex flex-col gap-4 mt-16 md:mt-0">
                <div className="flex items-center gap-3 text-blue-600 font-black text-[11px] uppercase tracking-[0.4em] mb-4">
                    <Activity size={16} /> Dashboard Analytics
                </div>
                <motion.h2 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="text-4xl md:text-8xl font-black text-slate-900 dark:text-white tracking-[-0.04em] leading-none"
                >
                    Активность<span className="text-blue-500">.</span>
                </motion.h2>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard icon={<BookOpen className="text-blue-500"/>} label="Всего знаний" value={stats.total} color="blue" />
                <StatCard icon={<CheckCircle2 className="text-emerald-500"/>} label="Завершено" value={stats.finished} color="emerald" />
                <StatCard icon={<Clock className="text-amber-500"/>} label="В процессе" value={stats.inWork} color="amber" />
                <StatCard icon={<Target className="text-purple-500"/>} label="Цели" value={goals.length} color="purple" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Activity Chart */}
                <div className="bg-white dark:bg-slate-950 p-8 rounded-[3rem] border border-slate-200 dark:border-white/5 shadow-xl">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                            <TrendingUp size={14} className="text-blue-500" /> Недельная активность
                        </h3>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ReBarChart data={stats.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} 
                                />
                                <YAxis hide />
                                <Tooltip 
                                    cursor={{fill: '#88888810'}}
                                    contentStyle={{ 
                                        borderRadius: '1rem', 
                                        border: 'none', 
                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                        backgroundColor: '#fff',
                                        fontSize: '12px',
                                        fontWeight: 'bold'
                                    }}
                                />
                                <Bar dataKey="count" radius={[10, 10, 10, 10]}>
                                    {stats.chartData.map((_entry, index: number) => (
                                        <Cell key={`cell-${index}`} fill={`rgba(59, 130, 246, ${0.4 + (index / Math.max(1, stats.chartData.length)) * 0.6})`} />
                                    ))}
                                </Bar>
                            </ReBarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Categories Map */}
                <div className="bg-white dark:bg-slate-950 p-8 rounded-[3rem] border border-slate-200 dark:border-white/5 shadow-xl">
                    <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-8 flex items-center gap-3">
                        <PieChart size={14} className="text-emerald-500" /> Тематические кластеры
                    </h3>
                    <div className="space-y-4">
                        {(Object.entries(stats.catCounts) as [string, number][]).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, count]: [string, number]) => {
                            const colors = getTagColor(cat);
                            return (
                                <div key={cat} className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black" style={{ backgroundColor: colors.bg, color: colors.text }}>
                                        {count}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-200">{cat}</span>
                                            <span className="text-[10px] font-bold text-slate-400">{Math.round((count / stats.total) * 100)}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full transition-all duration-1000" 
                                                style={{ width: `${(count / stats.total) * 100}%`, backgroundColor: colors.border }} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ icon: React.ReactNode, label: string, value: number, color: string }> = ({ icon, label, value, color }) => {
    return (
        <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-slate-950 p-8 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-lg group"
        >
            <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">
                    {icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-tight">{label}</span>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{value}</div>
        </motion.div>
    );
};

export default DashboardPage;
