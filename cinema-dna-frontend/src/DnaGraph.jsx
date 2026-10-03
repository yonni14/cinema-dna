import React, { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const DnaGraph = (props) => {
  const currentMovie =
    props.currentMovie ||
    props.movie ||
    props.selectedMovie ||
    props.activeMovie ||
    null;

  const recommendations =
    props.recommendations ||
    props.similarMovies ||
    props.recs ||
    [];

  const onSelectMovie =
    props.onSelectMovie ||
    props.onMovieSelect ||
    props.setSelectedMovie;

  const fgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 680, height: 420 });
  const imagesCache = useRef({});

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const graphData = useMemo(() => {
    if (!currentMovie) return { nodes: [], links: [] };

    const centerId = String(currentMovie.id || 'center');
    const nodes = [
      {
        id: centerId,
        title: currentMovie.h_title || currentMovie.display_h || currentMovie.e_title || 'SELECTED',
        poster: currentMovie.local_poster,
        isCenter: true,
        x: 0,
        y: 0,
      },
    ];

    const links = [];
    const recList = Array.isArray(recommendations) ? recommendations : [];
    const radius = 130;

    recList.forEach((item, idx) => {
      const m = item.movie || item;
      if (!m) return;
      const targetId = String(m.id || `rec-${idx}`);
      const angle = (idx / (recList.length || 1)) * 2 * Math.PI;

      nodes.push({
        id: targetId,
        title: m.h_title || m.display_h || m.e_title || '',
        score: item.score,
        poster: m.local_poster,
        isCenter: false,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });

      links.push({
        source: centerId,
        target: targetId,
      });
    });

    return { nodes, links };
  }, [currentMovie, recommendations]);

  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      const timer = setTimeout(() => {
        fgRef.current.centerAt(0, 0, 250);
        fgRef.current.zoom(1.1, 250);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [graphData]);

  const resolvePosterUrl = (poster) => {
    if (!poster) return null;
    if (poster.startsWith('http://') || poster.startsWith('https://')) return poster;
    const clean = poster.replace(/^\/+/, '');
    return `/${clean}`;
  };

  const drawNode = (node, ctx, globalScale) => {
    const x = typeof node.x === 'number' ? node.x : 0;
    const y = typeof node.y === 'number' ? node.y : 0;
    const radius = node.isCenter ? 22 : 16;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.lineWidth = 1;
    ctx.strokeStyle = node.isCenter ? '#E34234' : '#F1F0E9';
    ctx.stroke();
    ctx.clip();

    const imgUrl = resolvePosterUrl(node.poster);
    if (imgUrl) {
      if (!imagesCache.current[imgUrl]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imgUrl;
        img.onload = () => {
          imagesCache.current[imgUrl] = img;
          if (fgRef.current) fgRef.current.refresh();
        };
        img.onerror = () => {
          imagesCache.current[imgUrl] = 'failed';
        };
        imagesCache.current[imgUrl] = 'loading';
      }

      const cached = imagesCache.current[imgUrl];
      if (cached instanceof HTMLImageElement && cached.complete && cached.naturalWidth > 0) {
        ctx.drawImage(cached, x - radius, y - radius, radius * 2, radius * 2);
      } else {
        ctx.fillStyle = '#171A18';
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    } else {
      ctx.fillStyle = '#171A18';
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.restore();

    if (node.title) {
      const fontSize = 10 / globalScale;
      ctx.font = `400 ${Math.max(fontSize, 3.5)}px Heebo, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#F1F0E9';
      ctx.fillText(node.title, x, y + radius + 4);
    }
  };

  const handleZoom = (type) => {
    if (!fgRef.current) return;
    const currentZoom = fgRef.current.zoom();
    const nextZoom = type === 'in' ? currentZoom * 1.25 : currentZoom / 1.25;
    fgRef.current.zoom(nextZoom, 200);
  };

  const handleCenter = () => {
    if (fgRef.current) {
      fgRef.current.centerAt(0, 0, 250);
      fgRef.current.zoom(1.1, 250);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[420px] bg-[#111311] border border-[#303430] rounded-none overflow-hidden select-none"
      dir="ltr"
    >
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={handleCenter}
          className="font-mono-tech text-[10px] tracking-widest text-[#969A94] hover:text-[#F1F0E9] bg-[#151815] border border-[#303430] px-2.5 py-1 cursor-pointer uppercase"
        >
          [ CENTER GRAPH ]
        </button>
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center border border-[#303430] bg-[#151815]">
        <button
          type="button"
          onClick={() => handleZoom('in')}
          className="w-6 h-6 flex items-center justify-center font-mono-tech text-xs text-[#969A94] hover:text-[#F1F0E9] border-r border-[#303430] cursor-pointer"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => handleZoom('out')}
          className="w-6 h-6 flex items-center justify-center font-mono-tech text-xs text-[#969A94] hover:text-[#F1F0E9] cursor-pointer"
        >
          −
        </button>
      </div>

      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeCanvasObject={drawNode}
        nodePointerAreaPaint={(node, color, ctx) => {
          const r = node.isCenter ? 22 : 16;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={() => '#303430'}
        linkWidth={1}
        enableZoomInteraction={false}
        enablePanInteraction={true}
        cooldownTicks={60}
        onNodeClick={(node) => {
          if (!node.isCenter && onSelectMovie) {
            onSelectMovie(Number(node.id));
          }
        }}
      />
    </div>
  );
};

export default DnaGraph;