
import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { Note } from '../types.ts';
import { useNavigate } from 'react-router-dom';
import { Search, ZoomIn, ZoomOut, Maximize, MousePointer2, X, Zap, Lock, Unlock, Filter, Eye, EyeOff, Hash, FolderTree, User, RefreshCw, LayoutTemplate, Sparkles } from 'lucide-react';
import { getTagColor } from '../utils/tagColors.ts';
import { motion, AnimatePresence } from 'motion/react';

interface GraphNode extends d3.SimulationNodeDatum {
    id: string;
    title: string;
    type: 'note' | 'tag' | 'category' | 'concept';
    color?: string;
    radius?: number;
    val?: number;
    linksCount?: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
    source: string | GraphNode;
    target: string | GraphNode;
}

interface GraphViewProps {
    notes: Note[];
    layoutType?: 'force' | 'tree' | 'circular';
    searchTerm?: string;
    setSearchTerm?: (val: string) => void;
}

const GraphView: React.FC<GraphViewProps> = ({ notes, layoutType = 'force', searchTerm = '', setSearchTerm }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    // Local fallback if props not provided
    const [localSearch, setLocalSearch] = useState('');
    const actualSearch = setSearchTerm ? searchTerm : localSearch;
    const updateSearch = setSearchTerm ? setSearchTerm : setLocalSearch;

    const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [currentLayout, setCurrentLayout] = useState<'force' | 'circular'>(layoutType === 'tree' ? 'circular' : 'force');
    const [isLocked, setIsLocked] = useState(false);
    const prevDataRef = useRef<GraphNode[]>([]);
    const [showTags, setShowTags] = useState(true);
    const [showConcepts, setShowConcepts] = useState(true);
    const [showOrphans, setShowOrphans] = useState(true);
    const [showCategories, setShowCategories] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

    const data = useMemo(() => {
        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];
        const tagsMap = new Map<string, string[]>();
        const conceptsMap = new Map<string, string[]>();
        const categoriesMap = new Map<string, string[]>();
        const connectionsCount = new Map<string, number>();

        // Previous nodes map for position persistence
        const prevNodesMap = new Map<string, GraphNode>(prevDataRef.current.map(n => [n.id, n]));

        const getNodeWithPosition = (baseNode: GraphNode): GraphNode => {
            const prev = prevNodesMap.get(baseNode.id);
            if (prev) {
                return {
                    ...baseNode,
                    x: prev.x,
                    y: prev.y,
                    vx: prev.vx,
                    vy: prev.vy,
                    fx: prev.fx,
                    fy: prev.fy
                };
            }
            return baseNode;
        };

        // 1. Process Notes
        notes.forEach(note => {
            const cat = note.category || 'Общее';
            if (!categoriesMap.has(cat)) categoriesMap.set(cat, []);
            categoriesMap.get(cat)?.push(note.id);

            (note.tags || note.hashtags || []).forEach(tag => {
                if (!tagsMap.has(tag)) tagsMap.set(tag, []);
                tagsMap.get(tag)?.push(note.id);
            });

            (note.related_nodes || []).forEach(concept => {
                if (!conceptsMap.has(concept)) conceptsMap.set(concept, []);
                conceptsMap.get(concept)?.push(note.id);
            });
        });

        // 2. Add Category Nodes (Hubs)
        if (showCategories) {
            categoriesMap.forEach((noteIds, cat) => {
                const colors = getTagColor(cat);
                nodes.push(getNodeWithPosition({
                    id: `cat-${cat}`,
                    title: cat,
                    type: 'category',
                    color: colors.border,
                    val: 40 + noteIds.length * 2
                }));
            });
        }

        // 3. Add Tag Nodes
        if (showTags) {
            tagsMap.forEach((noteIds, tag) => {
                nodes.push(getNodeWithPosition({
                    id: `tag-${tag}`,
                    title: `#${tag}`,
                    type: 'tag',
                    color: '#10b981',
                    val: 15 + noteIds.length
                }));
            });
        }

        // 3.1. Add Concept Nodes (from related_nodes)
        if (showConcepts) {
            conceptsMap.forEach((noteIds, concept) => {
                nodes.push(getNodeWithPosition({
                    id: `concept-${concept}`,
                    title: `✦ ${concept}`,
                    type: 'concept',
                    color: '#f59e0b',
                    val: 18 + noteIds.length * 2
                }));
            });
        }

        // 4. Add Note Nodes
        notes.forEach(note => {
            const cat = note.category || 'Общее';
            const colors = getTagColor(cat);
            
            // Check if orphan
            const tags = note.tags || note.hashtags || [];
            const concepts = note.related_nodes || [];
            const hasTags = tags.length > 0;
            const hasConcepts = concepts.length > 0;
            const hasLinks = note.links && note.links.length > 0;
            const isOrphan = !hasTags && !hasConcepts && !hasLinks;

            if (!showOrphans && isOrphan) return;

            nodes.push(getNodeWithPosition({
                id: note.id,
                title: note.title || 'Untitled',
                type: 'note',
                color: colors.border,
                val: 25
            }));

            // Links to category
            if (showCategories) {
                links.push({ source: note.id, target: `cat-${cat}` });
                connectionsCount.set(note.id, (connectionsCount.get(note.id) || 0) + 1);
                connectionsCount.set(`cat-${cat}`, (connectionsCount.get(`cat-${cat}`) || 0) + 1);
            }

            // Links to tags
            if (showTags) {
                tags.forEach(tag => {
                    links.push({ source: note.id, target: `tag-${tag}` });
                    connectionsCount.set(note.id, (connectionsCount.get(note.id) || 0) + 1);
                    connectionsCount.set(`tag-${tag}`, (connectionsCount.get(`tag-${tag}`) || 0) + 1);
                });
            }

            // Links to concepts
            if (showConcepts) {
                concepts.forEach(concept => {
                    links.push({ source: note.id, target: `concept-${concept}` });
                    connectionsCount.set(note.id, (connectionsCount.get(note.id) || 0) + 1);
                    connectionsCount.set(`concept-${concept}`, (connectionsCount.get(`concept-${concept}`) || 0) + 1);
                });
            }

            // Internal links between notes
            if (note.links) {
                note.links.forEach(targetId => {
                    if (notes.find(n => n.id === targetId)) {
                        links.push({ source: note.id, target: targetId });
                        connectionsCount.set(note.id, (connectionsCount.get(note.id) || 0) + 1);
                        connectionsCount.set(targetId, (connectionsCount.get(targetId) || 0) + 1);
                    }
                });
            }
        });

        // Set radius based on connections
        nodes.forEach(n => {
            const count = connectionsCount.get(n.id) || 0;
            n.radius = Math.max(n.type === 'category' ? 12 : n.type === 'concept' ? 8 : n.type === 'note' ? 6 : 4, Math.sqrt(count) * 4);
            n.linksCount = count;
        });

        return { nodes, links };
    }, [notes, showTags, showConcepts, showOrphans, showCategories]);

    useEffect(() => {
        if (!svgRef.current) return;
        const svg = d3.select(svgRef.current);
        const node = svg.selectAll<SVGGElement, GraphNode>('.node');
        const link = svg.selectAll<SVGLineElement, GraphLink>('line');

        // Update link highlighting
        if (selectedNodeId) {
            const connectedNodeIds = new Set<string>([selectedNodeId]);
            data.links.forEach(l => {
                const s = (l.source as any).id || l.source;
                const t = (l.target as any).id || l.target;
                if (s === selectedNodeId) connectedNodeIds.add(String(t));
                if (t === selectedNodeId) connectedNodeIds.add(String(s));
            });

            link.style('stroke-opacity', (l: any) => {
                const s = l.source.id || l.source;
                const t = l.target.id || l.target;
                return s === selectedNodeId || t === selectedNodeId ? 0.8 : 0.05;
            }).style('stroke', (l: any) => {
                const s = l.source.id || l.source;
                const t = l.target.id || l.target;
                return s === selectedNodeId || t === selectedNodeId ? '#3b82f6' : '#94a3b8';
            });

            node.style('opacity', (d: any) => connectedNodeIds.has(d.id) ? 1 : 0.2);
        } else {
            link.style('stroke-opacity', 0.1).style('stroke', '#94a3b8');
            node.style('opacity', 1);
        }

        // Update Labels (Opacity and Size)
        node.select('text')
            .style('opacity', (d: GraphNode) => {
                const isSearched = actualSearch && d.title.toLowerCase().includes(actualSearch.toLowerCase());
                const isSelected = d.id === selectedNodeId;
                const isHovered = d.id === hoveredNodeId;
                const isNeighborHovered = hoveredNodeId && data.links.some(l => 
                    (String((l.source as any).id || l.source) === hoveredNodeId && String((l.target as any).id || l.target) === d.id) ||
                    (String((l.target as any).id || l.target) === hoveredNodeId && String((l.source as any).id || l.source) === d.id)
                );
                return isSearched || isSelected || isHovered || isNeighborHovered ? 1 : 0;
            })
            .style('font-size', (d: GraphNode) => 
                (actualSearch && d.title.toLowerCase().includes(actualSearch.toLowerCase())) || d.id === selectedNodeId ? '12px' : '9px'
            );

        // Update selection styles on circles
        node.select('circle')
            .attr('stroke-width', (d: GraphNode) => d.id === selectedNodeId ? 4 : 2)
            .style('filter', (d: GraphNode) => d.id === selectedNodeId || d.id === hoveredNodeId ? 'url(#glow)' : 'none');

    }, [actualSearch, selectedNodeId, hoveredNodeId, data.links]);

    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const svg = d3.select(svgRef.current)
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`);

        svg.selectAll('*').remove();

        // Definitions for glows
        const defs = svg.append('defs');
        const filter = defs.append('filter').attr('id', 'glow');
        filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur');
        const feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        const g = svg.append('g');

        // Zoom setup
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 8])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        const simulation = d3.forceSimulation<GraphNode>(data.nodes)
            .force('link', d3.forceLink<GraphNode, GraphLink>(data.links).id(d => d.id).distance((d: any) => {
                const source = d.source as GraphNode;
                const target = d.target as GraphNode;
                if (source.type === 'category' || target.type === 'category') return 200;
                return currentLayout === 'circular' ? 80 : 120;
            }))
            .force('charge', d3.forceManyBody().strength((d: any) => {
                return d.type === 'category' ? -2000 : -400;
            }))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide<GraphNode>().radius(d => (d.radius || 10) + 30))
            .velocityDecay(0.6) 
            .alphaDecay(0.04); 
        
        simulation.alphaMin(0.01); 
        simulationRef.current = simulation;

        // Auto-stop simulation logic to ensure stillness
        const stopSimulation = () => {
            if (simulationRef.current) {
                simulationRef.current.stop();
                // Round positions to prevent sub-pixel jittering
                data.nodes.forEach(n => {
                    if (n.x) n.x = Math.round(n.x * 10) / 10;
                    if (n.y) n.y = Math.round(n.y * 10) / 10;
                });
                ticked();
                // Save final positions for next render
                prevDataRef.current = [...data.nodes];
            }
        };

        // Run simulation for a fixed duration then freeze
        const restartSimulation = () => {
            simulation.alpha(1).restart();
            // Force simulation to stop after 2 seconds precisely
            setTimeout(stopSimulation, 2000); 
        };

        const needsLayout = data.nodes.some(n => n.x === undefined);
        if (needsLayout || !isLocked) {
            restartSimulation();
        } else {
            simulation.stop();
        }

        if (currentLayout === 'circular') {
            simulation.force('radial', d3.forceRadial(Math.min(width, height) / 3, width / 2, height / 2).strength(0.8));
        }

        const link = g.append('g')
            .selectAll<SVGLineElement, GraphLink>('line')
            .data(data.links)
            .join('line')
            .attr('stroke', '#94a3b8')
            .attr('stroke-opacity', 0.1)
            .attr('stroke-width', 1);

        const node = g.append('g')
            .selectAll<SVGGElement, GraphNode>('.node')
            .data(data.nodes)
            .join('g')
            .attr('class', 'node')
            .call(d3.drag<SVGGElement, GraphNode>()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended) as any)
            .on('click', (event, d: GraphNode) => {
                event.stopPropagation();
                setSelectedNodeId(d.id === selectedNodeId ? null : d.id);
            })
            .on('mouseenter', (event, d: GraphNode) => setHoveredNodeId(d.id))
            .on('mouseleave', () => setHoveredNodeId(null))
            .on('dblclick', (event, d: GraphNode) => {
                if (d.type === 'note') {
                    navigate(`/editor/${d.id}`);
                }
            });

        // Circle with glow for active/search
        node.append('circle')
            .attr('r', (d: GraphNode) => d.radius || 10)
            .attr('fill', (d: GraphNode) => d.color || '#ccc')
            .attr('stroke', (d: GraphNode) => d.type === 'category' ? 'rgba(0,0,0,0.1)' : '#fff')
            .attr('stroke-width', (d: GraphNode) => d.id === selectedNodeId ? 4 : 2)
            .style('filter', (d: GraphNode) => d.id === selectedNodeId || d.id === hoveredNodeId ? 'url(#glow)' : 'none')
            .style('cursor', 'pointer')
            .attr('class', 'transition-all duration-300');

        // Label handling
        node.append('text')
            .attr('dy', (d: GraphNode) => (d.radius || 10) + 15)
            .attr('text-anchor', 'middle')
            .text((d: GraphNode) => d.title)
            .attr('class', 'text-[10px] font-black uppercase tracking-tight pointer-events-none fill-slate-900 dark:fill-slate-100 select-none')
            .style('opacity', (d: GraphNode) => {
                const isSearched = actualSearch && d.title.toLowerCase().includes(actualSearch.toLowerCase());
                const isSelected = d.id === selectedNodeId;
                const isHovered = d.id === hoveredNodeId;
                const isNeighborHovered = hoveredNodeId && data.links.some(l => 
                    (String((l.source as any).id || l.source) === hoveredNodeId && String((l.target as any).id || l.target) === d.id) ||
                    (String((l.target as any).id || l.target) === hoveredNodeId && String((l.source as any).id || l.source) === d.id)
                );
                return isSearched || isSelected || isHovered || isNeighborHovered ? 1 : 0;
            })
            .style('font-size', (d: GraphNode) => 
                (actualSearch && d.title.toLowerCase().includes(actualSearch.toLowerCase())) || d.id === selectedNodeId ? '12px' : '9px'
            );

        const ticked = () => {
            link
                .attr('x1', (d: GraphLink) => ((d.source as any) as GraphNode).x!)
                .attr('y1', (d: GraphLink) => ((d.source as any) as GraphNode).y!)
                .attr('x2', (d: GraphLink) => ((d.target as any) as GraphNode).x!)
                .attr('y2', (d: GraphLink) => ((d.target as any) as GraphNode).y!);

            node.attr('transform', (d: GraphNode) => `translate(${d.x},${d.y})`);
        };

        simulation.on('tick', ticked);

        // Highlight logic removed from main loop, handled in separate effect

        function dragstarted(event: any, d: any) {
            if (!event.active && !isLocked) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event: any, d: any) {
            d.fx = event.x;
            d.fy = event.y;
            // If locked, we need to manually update position during drag and call tick
            if (isLocked) {
                d.x = event.x;
                d.y = event.y;
                ticked();
            }
        }

        function dragended(event: any, d: any) {
            if (!event.active) {
                simulation.alphaTarget(0);
                simulation.alpha(0.05).restart(); // Quickly cool down on release
            }
            if (!isLocked) {
                d.fx = null;
                d.fy = null;
            }
        }

        return () => {
            simulation.stop();
        };
    }, [data, navigate, currentLayout, isLocked]);

    const resetZoom = () => {
        if (!svgRef.current) return;
        d3.select(svgRef.current).transition().call(d3.zoom<SVGSVGElement, unknown>().transform as any, d3.zoomIdentity);
    };

    return (
        <div ref={containerRef} className="w-full h-full bg-slate-50 dark:bg-slate-950 rounded-[3rem] border border-slate-200 dark:border-white/5 overflow-hidden relative">
            {/* Grid Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-grid-slate-900/[0.1] bg-[size:40px_40px] dark:bg-grid-white/[0.05]" />
            
            {/* Brain Connectivity Overlay */}
            <div className="absolute top-32 left-8 z-10 pointer-events-none hidden md:block">
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col gap-3"
                >
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-1">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < Math.min(notes.length / 5, 5) ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                            ))}
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Системная плотность</span>
                    </div>
                </motion.div>
            </div>

               {/* Graph Local Controls - Vertical Bar on Right */}
            <div className="absolute right-8 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-3 pointer-events-none">
                <div className="flex flex-col items-center gap-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-2 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl pointer-events-auto">
                   <button 
                    onClick={() => {
                        if (simulationRef.current) {
                            setIsLocked(false);
                            simulationRef.current.alpha(0.8).restart();
                            setTimeout(() => {
                                simulationRef.current?.stop();
                                setIsLocked(true);
                            }, 2000);
                        }
                    }} 
                    className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-colors text-slate-400 hover:text-blue-500" 
                    title="Упорядочить узлы"
                   >
                     <RefreshCw size={18}/>
                   </button>
                   
                   <div className="w-8 h-px bg-slate-200 dark:bg-white/10" />
                   
                   <div className="relative">
                        <button 
                            onClick={() => setShowFilters(!showFilters)} 
                            className={`p-2.5 rounded-xl transition-all ${showFilters ? 'bg-slate-200 dark:bg-white/10 text-blue-600' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`} 
                            title="Фильтры отображения"
                        >
                            <Filter size={18}/>
                        </button>
                        <AnimatePresence>
                            {showFilters && (
                                <motion.div 
                                    initial={{ opacity: 0, x: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: 10, scale: 0.95 }}
                                    className="absolute right-full mr-3 top-0 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 z-[100]"
                                >
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Filter size={12}/> Видимость
                                    </h4>
                                    <div className="space-y-2">
                                        <button 
                                            onClick={() => setShowTags(!showTags)}
                                            className="w-full flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors"
                                        >
                                            <span className="text-[11px] font-bold dark:text-slate-300 flex items-center gap-2"><Hash size={14} className="text-emerald-500"/> Теги</span>
                                            {showTags ? <Eye size={16} className="text-blue-500"/> : <EyeOff size={16} className="text-slate-400"/>}
                                        </button>
                                        <button 
                                            onClick={() => setShowConcepts(!showConcepts)}
                                            className="w-full flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors"
                                        >
                                            <span className="text-[11px] font-bold dark:text-slate-300 flex items-center gap-2"><Sparkles size={14} className="text-amber-500"/> Концепции (AI)</span>
                                            {showConcepts ? <Eye size={16} className="text-blue-500"/> : <EyeOff size={16} className="text-slate-400"/>}
                                        </button>
                                        <button 
                                            onClick={() => setShowCategories(!showCategories)}
                                            className="w-full flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors"
                                        >
                                            <span className="text-[11px] font-bold dark:text-slate-300 flex items-center gap-2"><FolderTree size={14} className="text-blue-500"/> Хабы категорий</span>
                                            {showCategories ? <Eye size={16} className="text-blue-500"/> : <EyeOff size={16} className="text-slate-400"/>}
                                        </button>
                                        <button 
                                            onClick={() => setShowOrphans(!showOrphans)}
                                            className="w-full flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors"
                                        >
                                            <span className="text-[11px] font-bold dark:text-slate-300 flex items-center gap-2"><User size={14} className="text-slate-400"/> Одиночки</span>
                                            {showOrphans ? <Eye size={16} className="text-blue-500"/> : <EyeOff size={16} className="text-slate-400"/>}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                   </div>

                   <div className="w-8 h-px bg-slate-200 dark:bg-white/10" />

                   <button 
                    onClick={() => setIsLocked(!isLocked)} 
                    className={`p-2.5 rounded-xl transition-all ${isLocked ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`} 
                    title={isLocked ? "Разблокировать" : "Закрепить"}
                   >
                     {isLocked ? <Lock size={18}/> : <Unlock size={18}/>}
                   </button>
                   
                   <button 
                    onClick={() => setCurrentLayout(currentLayout === 'force' ? 'circular' : 'force')} 
                    className={`p-2.5 rounded-xl transition-all ${currentLayout === 'circular' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`} 
                    title="Тип раскладки"
                   >
                     <LayoutTemplate size={18}/>
                   </button>

                   <div className="w-8 h-px bg-slate-200 dark:bg-white/10" />

                   <button onClick={resetZoom} className="p-2.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-blue-500" title="Сброс зума"><Maximize size={18}/></button>
                   
                   <button 
                    onClick={() => {
                        simulationRef.current?.stop();
                        setIsLocked(true);
                    }} 
                    className="p-2.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors text-slate-400 hover:text-red-500" 
                    title="Заморозить"
                   >
                     <X size={18}/>
                   </button>
                </div>
            </div>

            {selectedNodeId && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 backdrop-blur-md">
                    <MousePointer2 size={16} className="animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest">Двойной клик для перехода</span>
                    <button onClick={() => setSelectedNodeId(null)} className="ml-2 hover:opacity-70 p-1 hover:bg-white/10 rounded-lg transition-colors"><X size={14}/></button>
                </div>
            )}

            <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" onClick={() => setSelectedNodeId(null)} />
        </div>
    );
};

export default GraphView;
