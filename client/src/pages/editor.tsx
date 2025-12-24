import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Stage, Layer, Rect, Circle, Line, Arrow, Text, Transformer } from 'react-konva';
import * as pdfjs from 'pdfjs-dist';
import { useAuth } from '@/lib/auth-context';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  Layers,
  MousePointer2,
  Pencil,
  Minus,
  ArrowRight,
  Square,
  Circle as CircleIcon,
  Type,
  Ruler,
  TriangleRight,
  Eraser,
  Save,
  Undo2,
  Redo2,
  Download,
  ChevronDown,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Eye,
  EyeOff,
  Trash2,
  GripVertical,
  Cloud,
  Loader2,
} from 'lucide-react';
import type { Project, AnnotationShape, LayerData } from '@shared/schema';
import Konva from 'konva';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

type Tool = 'select' | 'freehand' | 'line' | 'arrow' | 'rect' | 'circle' | 'text' | 'measurement' | 'angle' | 'eraser';

const tools: { id: Tool; icon: typeof MousePointer2; label: string; shortcut: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select / Move', shortcut: 'V' },
  { id: 'freehand', icon: Pencil, label: 'Freehand Drawing', shortcut: 'P' },
  { id: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow', shortcut: 'A' },
  { id: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { id: 'circle', icon: CircleIcon, label: 'Circle / Ellipse', shortcut: 'C' },
  { id: 'text', icon: Type, label: 'Text / Comment', shortcut: 'T' },
  { id: 'measurement', icon: Ruler, label: 'Measurement - Scale / Tape', shortcut: 'M' },
  { id: 'angle', icon: TriangleRight, label: 'Measurement - Angle', shortcut: 'G' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E' },
];

const colorPresets = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff', '#000000',
];

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  
  const [strokeColor, setStrokeColor] = useState('#3b82f6');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [opacity, setOpacity] = useState(100);
  const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [measurementUnit, setMeasurementUnit] = useState<'mm' | 'cm' | 'ft'>('cm');
  
  const [zoom, setZoom] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfImage, setPdfImage] = useState<HTMLImageElement | null>(null);
  const [pdfDocument, setPdfDocument] = useState<pdfjs.PDFDocumentProxy | null>(null);
  
  const [layers, setLayers] = useState<LayerData[]>([
    { id: 'pdf-background', name: 'PDF Background', type: 'pdf', visible: true, locked: true, shapes: [] },
    { id: 'annotations', name: 'Annotations', type: 'annotation', visible: true, locked: false, shapes: [] },
    { id: 'measurements', name: 'Measurements', type: 'measurement', visible: true, locked: false, shapes: [] },
  ]);
  
  const [history, setHistory] = useState<LayerData[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ['/api/projects', params.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${params.id}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json();
    },
    enabled: !!params.id,
  });

  const saveAnnotationsMutation = useMutation({
    mutationFn: async (data: { projectId: string; pageNumber: number; layers: LayerData[] }) => {
      const response = await fetch(`/api/annotations/${data.projectId}/${data.pageNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: data.layers }),
      });
      if (!response.ok) throw new Error('Failed to save annotations');
      return response.json();
    },
    onSuccess: () => {
      setAutoSaveStatus('saved');
    },
    onError: () => {
      setAutoSaveStatus('unsaved');
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/projects/${projectId}/save`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to save project');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', params.id] });
      toast({
        title: 'Project saved',
        description: 'Your project has been saved successfully.',
      });
    },
  });

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    setAutoSaveStatus('unsaved');
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (params.id) {
        setAutoSaveStatus('saving');
        saveAnnotationsMutation.mutate({
          projectId: params.id,
          pageNumber: currentPage,
          layers: layers,
        });
      }
    }, 1000);
  }, [params.id, currentPage, layers, saveAnnotationsMutation]);

  useEffect(() => {
    const loadPdf = async () => {
      if (!project?.pdfUrl) return;
      
      try {
        const loadingTask = pdfjs.getDocument(project.pdfUrl);
        const pdf = await loadingTask.promise;
        setPdfDocument(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(parseInt(project.currentPage) || 1);
      } catch (error) {
        console.error('Failed to load PDF:', error);
        toast({
          title: 'Error',
          description: 'Failed to load PDF. Please try again.',
          variant: 'destructive',
        });
      }
    };

    loadPdf();
  }, [project?.pdfUrl, toast]);

  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDocument) return;
      
      try {
        const page = await pdfDocument.getPage(currentPage);
        const scale = 2;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        } as any).promise;
        
        const img = new Image();
        img.src = canvas.toDataURL();
        img.onload = () => {
          setPdfImage(img);
          fitToScreen(img.width, img.height);
        };
      } catch (error) {
        console.error('Failed to render page:', error);
      }
    };

    renderPage();
  }, [pdfDocument, currentPage]);

  useEffect(() => {
    const loadAnnotations = async () => {
      if (!params.id) return;
      
      const defaultLayers: LayerData[] = [
        { id: 'pdf-background', name: 'PDF Background', type: 'pdf', visible: true, locked: true, shapes: [] },
        { id: 'annotations', name: 'Annotations', type: 'annotation', visible: true, locked: false, shapes: [] },
        { id: 'measurements', name: 'Measurements', type: 'measurement', visible: true, locked: false, shapes: [] },
      ];
      
      try {
        const response = await fetch(`/api/annotations/${params.id}/${currentPage}`);
        if (response.ok) {
          const result = await response.json();
          if (result && result.data && Array.isArray(result.data)) {
            setLayers(result.data);
            setHistory([JSON.parse(JSON.stringify(result.data))]);
            setHistoryIndex(0);
          } else {
            setLayers(defaultLayers);
            setHistory([JSON.parse(JSON.stringify(defaultLayers))]);
            setHistoryIndex(0);
          }
        } else {
          setLayers(defaultLayers);
          setHistory([JSON.parse(JSON.stringify(defaultLayers))]);
          setHistoryIndex(0);
        }
      } catch (error) {
        console.error('Failed to load annotations:', error);
        setLayers(defaultLayers);
        setHistory([JSON.parse(JSON.stringify(defaultLayers))]);
        setHistoryIndex(0);
      }
    };

    loadAnnotations();
  }, [params.id, currentPage]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toUpperCase();
      const tool = tools.find(t => t.shortcut === key);
      if (tool) {
        setActiveTool(tool.id);
      }
      
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        if (e.key === 's') {
          e.preventDefault();
          handleSaveProject();
        }
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedShapeId) {
          deleteShape(selectedShapeId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId]);

  const fitToScreen = (imgWidth?: number, imgHeight?: number) => {
    if (!containerRef.current) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = containerRef.current.offsetHeight;
    const width = imgWidth || pdfImage?.width || 800;
    const height = imgHeight || pdfImage?.height || 600;
    
    const scaleX = containerWidth / width;
    const scaleY = containerHeight / height;
    const newZoom = Math.min(scaleX, scaleY) * 0.9;
    
    setZoom(newZoom);
    setStagePosition({
      x: (containerWidth - width * newZoom) / 2,
      y: (containerHeight - height * newZoom) / 2,
    });
  };

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    if (!stage) return;
    
    const oldScale = zoom;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const mousePointTo = {
      x: (pointer.x - stagePosition.x) / oldScale,
      y: (pointer.y - stagePosition.y) / oldScale,
    };
    
    const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;
    const clampedScale = Math.max(0.1, Math.min(5, newScale));
    
    setZoom(clampedScale);
    setStagePosition({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  const generateId = () => `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addToHistory = (newLayers: LayerData[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newLayers)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setLayers(JSON.parse(JSON.stringify(history[historyIndex - 1])));
      triggerAutoSave();
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setLayers(JSON.parse(JSON.stringify(history[historyIndex + 1])));
      triggerAutoSave();
    }
  };

  const getTargetLayerId = (): string => {
    if (activeTool === 'measurement' || activeTool === 'angle') {
      return 'measurements';
    }
    return 'annotations';
  };

  const addShape = (shape: AnnotationShape) => {
    const layerId = getTargetLayerId();
    const newLayers = layers.map(layer => {
      if (layer.id === layerId) {
        return { ...layer, shapes: [...layer.shapes, shape] };
      }
      return layer;
    });
    setLayers(newLayers);
    addToHistory(newLayers);
    triggerAutoSave();
  };

  const updateShape = (shapeId: string, updates: Partial<AnnotationShape>) => {
    const newLayers = layers.map(layer => ({
      ...layer,
      shapes: layer.shapes.map(shape => 
        shape.id === shapeId ? { ...shape, ...updates } : shape
      ),
    }));
    setLayers(newLayers);
    addToHistory(newLayers);
    triggerAutoSave();
  };

  const deleteShape = (shapeId: string) => {
    const newLayers = layers.map(layer => ({
      ...layer,
      shapes: layer.shapes.filter(shape => shape.id !== shapeId),
    }));
    setLayers(newLayers);
    setSelectedShapeId(null);
    addToHistory(newLayers);
    triggerAutoSave();
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'select') {
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setSelectedShapeId(null);
        transformerRef.current?.nodes([]);
      }
      return;
    }

    if (activeTool === 'eraser') {
      const clickedShape = e.target;
      if (clickedShape.id() && clickedShape.id() !== 'pdf-image') {
        deleteShape(clickedShape.id());
      }
      return;
    }

    setIsDrawing(true);
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    const adjustedPos = {
      x: (pos.x - stagePosition.x) / zoom,
      y: (pos.y - stagePosition.y) / zoom,
    };

    if (activeTool === 'freehand') {
      setCurrentPoints([adjustedPos.x, adjustedPos.y]);
    } else {
      setCurrentPoints([adjustedPos.x, adjustedPos.y, adjustedPos.x, adjustedPos.y]);
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing) return;

    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    const adjustedPos = {
      x: (pos.x - stagePosition.x) / zoom,
      y: (pos.y - stagePosition.y) / zoom,
    };

    if (activeTool === 'freehand') {
      setCurrentPoints([...currentPoints, adjustedPos.x, adjustedPos.y]);
    } else {
      const newPoints = [...currentPoints];
      newPoints[2] = adjustedPos.x;
      newPoints[3] = adjustedPos.y;
      setCurrentPoints(newPoints);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || currentPoints.length < 4) {
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }

    const baseShape: Omit<AnnotationShape, 'type' | 'x' | 'y' | 'width' | 'height' | 'radius' | 'points'> = {
      id: generateId(),
      strokeColor,
      fillColor,
      strokeWidth,
      opacity: opacity / 100,
      lineStyle,
      visible: true,
      locked: false,
      name: `${activeTool} ${Date.now()}`,
    };

    let shape: AnnotationShape | null = null;

    switch (activeTool) {
      case 'freehand':
        shape = {
          ...baseShape,
          type: 'freehand',
          x: 0,
          y: 0,
          points: currentPoints,
        };
        break;
      case 'line':
        shape = {
          ...baseShape,
          type: 'line',
          x: 0,
          y: 0,
          points: currentPoints,
        };
        break;
      case 'arrow':
        shape = {
          ...baseShape,
          type: 'arrow',
          x: 0,
          y: 0,
          points: currentPoints,
        };
        break;
      case 'rect':
        const rectWidth = currentPoints[2] - currentPoints[0];
        const rectHeight = currentPoints[3] - currentPoints[1];
        shape = {
          ...baseShape,
          type: 'rect',
          x: currentPoints[0],
          y: currentPoints[1],
          width: rectWidth,
          height: rectHeight,
        };
        break;
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(currentPoints[2] - currentPoints[0], 2) +
          Math.pow(currentPoints[3] - currentPoints[1], 2)
        );
        shape = {
          ...baseShape,
          type: 'circle',
          x: currentPoints[0],
          y: currentPoints[1],
          radius,
        };
        break;
      case 'measurement':
        const measureDist = Math.sqrt(
          Math.pow(currentPoints[2] - currentPoints[0], 2) +
          Math.pow(currentPoints[3] - currentPoints[1], 2)
        );
        shape = {
          ...baseShape,
          type: 'measurement',
          x: 0,
          y: 0,
          points: currentPoints,
          measurementValue: measureDist,
          measurementUnit,
        };
        break;
      case 'angle':
        shape = {
          ...baseShape,
          type: 'angle',
          x: 0,
          y: 0,
          points: currentPoints,
        };
        break;
      case 'text':
        shape = {
          ...baseShape,
          type: 'text',
          x: currentPoints[0],
          y: currentPoints[1],
          text: 'Double click to edit',
          fontSize: 16,
        };
        break;
    }

    if (shape) {
      addShape(shape);
    }

    setIsDrawing(false);
    setCurrentPoints([]);
  };

  const handleShapeClick = (shapeId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool === 'eraser') {
      deleteShape(shapeId);
      return;
    }
    
    if (activeTool === 'select') {
      setSelectedShapeId(shapeId);
      const shape = e.target;
      transformerRef.current?.nodes([shape]);
    }
  };

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  const handleSaveProject = () => {
    if (params.id) {
      saveProjectMutation.mutate(params.id);
    }
  };

  const toggleLayerVisibility = (layerId: string) => {
    const newLayers = layers.map(layer => 
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    );
    setLayers(newLayers);
  };

  const getLineStyleDash = (style: string): number[] => {
    switch (style) {
      case 'dashed': return [10, 5];
      case 'dotted': return [2, 4];
      default: return [];
    }
  };

  const renderShape = (shape: AnnotationShape) => {
    const commonProps = {
      key: shape.id,
      id: shape.id,
      opacity: shape.opacity,
      visible: shape.visible,
      draggable: activeTool === 'select' && !shape.locked,
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => handleShapeClick(shape.id, e),
      onTap: (e: Konva.KonvaEventObject<TouchEvent>) => handleShapeClick(shape.id, e as any),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        updateShape(shape.id, { x: e.target.x(), y: e.target.y() });
      },
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
        const node = e.target;
        updateShape(shape.id, {
          x: node.x(),
          y: node.y(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
          rotation: node.rotation(),
        });
      },
    };

    switch (shape.type) {
      case 'rect':
        return (
          <Rect
            {...commonProps}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            stroke={shape.strokeColor}
            fill={shape.fillColor === 'transparent' ? undefined : shape.fillColor}
            strokeWidth={shape.strokeWidth}
            dash={getLineStyleDash(shape.lineStyle)}
          />
        );
      case 'circle':
        return (
          <Circle
            {...commonProps}
            x={shape.x}
            y={shape.y}
            radius={shape.radius}
            stroke={shape.strokeColor}
            fill={shape.fillColor === 'transparent' ? undefined : shape.fillColor}
            strokeWidth={shape.strokeWidth}
            dash={getLineStyleDash(shape.lineStyle)}
          />
        );
      case 'line':
      case 'freehand':
        return (
          <Line
            {...commonProps}
            points={shape.points}
            stroke={shape.strokeColor}
            strokeWidth={shape.strokeWidth}
            dash={getLineStyleDash(shape.lineStyle)}
            tension={shape.type === 'freehand' ? 0.5 : 0}
            lineCap="round"
            lineJoin="round"
          />
        );
      case 'arrow':
        return (
          <Arrow
            {...commonProps}
            points={shape.points || []}
            stroke={shape.strokeColor}
            fill={shape.strokeColor}
            strokeWidth={shape.strokeWidth}
            pointerLength={10}
            pointerWidth={10}
          />
        );
      case 'text':
        return (
          <Text
            {...commonProps}
            x={shape.x}
            y={shape.y}
            text={shape.text || 'Text'}
            fontSize={shape.fontSize || 16}
            fill={shape.strokeColor}
            fontFamily="Inter, sans-serif"
          />
        );
      case 'measurement':
        const points = shape.points || [0, 0, 100, 0];
        const distance = Math.sqrt(
          Math.pow(points[2] - points[0], 2) + Math.pow(points[3] - points[1], 2)
        );
        const midX = (points[0] + points[2]) / 2;
        const midY = (points[1] + points[3]) / 2;
        const unitLabel = shape.measurementUnit || 'cm';
        const displayValue = (distance / 10).toFixed(1);
        
        return (
          <>
            <Line
              {...commonProps}
              points={points}
              stroke={shape.strokeColor}
              strokeWidth={shape.strokeWidth}
              dash={[5, 5]}
            />
            <Text
              key={`${shape.id}-label`}
              x={midX}
              y={midY - 20}
              text={`${displayValue} ${unitLabel}`}
              fontSize={14}
              fill={shape.strokeColor}
              fontFamily="JetBrains Mono, monospace"
              align="center"
            />
          </>
        );
      default:
        return null;
    }
  };

  const renderDrawingPreview = () => {
    if (!isDrawing || currentPoints.length < 2) return null;

    const previewProps = {
      stroke: strokeColor,
      strokeWidth,
      opacity: opacity / 100,
      dash: getLineStyleDash(lineStyle),
      listening: false,
    };

    switch (activeTool) {
      case 'freehand':
        return (
          <Line
            points={currentPoints}
            {...previewProps}
            tension={0.5}
            lineCap="round"
            lineJoin="round"
          />
        );
      case 'line':
        return <Line points={currentPoints} {...previewProps} />;
      case 'arrow':
        return (
          <Arrow
            points={currentPoints}
            {...previewProps}
            fill={strokeColor}
            pointerLength={10}
            pointerWidth={10}
          />
        );
      case 'rect':
        return (
          <Rect
            x={currentPoints[0]}
            y={currentPoints[1]}
            width={currentPoints[2] - currentPoints[0]}
            height={currentPoints[3] - currentPoints[1]}
            {...previewProps}
            fill={fillColor === 'transparent' ? undefined : fillColor}
          />
        );
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(currentPoints[2] - currentPoints[0], 2) +
          Math.pow(currentPoints[3] - currentPoints[1], 2)
        );
        return (
          <Circle
            x={currentPoints[0]}
            y={currentPoints[1]}
            radius={radius}
            {...previewProps}
            fill={fillColor === 'transparent' ? undefined : fillColor}
          />
        );
      case 'measurement':
        const dist = Math.sqrt(
          Math.pow(currentPoints[2] - currentPoints[0], 2) +
          Math.pow(currentPoints[3] - currentPoints[1], 2)
        );
        const midX = (currentPoints[0] + currentPoints[2]) / 2;
        const midY = (currentPoints[1] + currentPoints[3]) / 2;
        return (
          <>
            <Line points={currentPoints} {...previewProps} dash={[5, 5]} />
            <Text
              x={midX}
              y={midY - 20}
              text={`${(dist / 10).toFixed(1)} ${measurementUnit}`}
              fontSize={14}
              fill={strokeColor}
              fontFamily="JetBrains Mono, monospace"
              listening={false}
            />
          </>
        );
      default:
        return null;
    }
  };

  if (projectLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-background">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/projects')}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="p-1.5 bg-primary rounded-md">
            <Layers className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-medium text-foreground text-sm">{project?.name || 'Untitled'}</span>
          
          <div className="flex items-center gap-1 ml-4 text-xs text-muted-foreground">
            {autoSaveStatus === 'saving' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Saving...</span>
              </>
            ) : autoSaveStatus === 'saved' ? (
              <>
                <Cloud className="w-3 h-3 text-green-500" />
                <span>Auto-saved</span>
              </>
            ) : (
              <>
                <Cloud className="w-3 h-3 text-yellow-500" />
                <span>Unsaved</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={historyIndex <= 0}
            data-testid="button-undo"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            data-testid="button-redo"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="h-6 mx-2" />
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveProject}
            disabled={saveProjectMutation.isPending}
            data-testid="button-save"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Project
          </Button>
          
          <Button variant="outline" size="sm" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Separator orientation="vertical" className="h-6 mx-2" />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2" data-testid="button-user-menu">
                <span className="text-sm">Hello, {user?.name}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-16 border-r border-border bg-card shrink-0 flex flex-col py-2">
          {tools.map((tool, index) => (
            <div key={tool.id}>
              {index === 7 && <Separator className="my-2" />}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === tool.id ? 'secondary' : 'ghost'}
                    size="icon"
                    className="w-12 h-12 mx-auto my-0.5"
                    onClick={() => setActiveTool(tool.id)}
                    data-testid={`button-tool-${tool.id}`}
                  >
                    <tool.icon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{tool.label}</p>
                  <p className="text-xs text-muted-foreground">Shortcut: {tool.shortcut}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          ))}
        </aside>

        <main 
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-muted/30"
          style={{ cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
        >
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            x={stagePosition.x}
            y={stagePosition.y}
            scaleX={zoom}
            scaleY={zoom}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown as any}
            onTouchMove={handleMouseMove as any}
            onTouchEnd={handleMouseUp as any}
          >
            <Layer>
              {pdfImage && (
                <Rect
                  id="pdf-image"
                  x={0}
                  y={0}
                  width={pdfImage.width}
                  height={pdfImage.height}
                  fillPatternImage={pdfImage}
                  listening={false}
                />
              )}
            </Layer>
            
            {layers.filter(layer => layer.visible && layer.type !== 'pdf').map(layer => (
              <Layer key={layer.id}>
                {layer.shapes.map(renderShape)}
              </Layer>
            ))}
            
            <Layer>
              {renderDrawingPreview()}
              <Transformer ref={transformerRef} />
            </Layer>
          </Stage>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card border border-border rounded-md px-3 py-2 shadow-lg">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono min-w-[60px] text-center" data-testid="text-page-number">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-card border border-border rounded-md p-1 shadow-lg">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono min-w-[50px] text-center" data-testid="text-zoom-level">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom(Math.min(5, zoom + 0.1))}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fitToScreen()}
              data-testid="button-fit-screen"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </main>

        <aside className="w-72 border-l border-border bg-card shrink-0 flex flex-col">
          <Tabs defaultValue="properties" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-border">
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="layers">Layers</TabsTrigger>
            </TabsList>
            
            <TabsContent value="properties" className="flex-1 m-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Stroke Color
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {colorPresets.map(color => (
                        <button
                          key={color}
                          className={`w-7 h-7 rounded-md border-2 transition-all ${
                            strokeColor === color ? 'border-primary scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setStrokeColor(color)}
                          data-testid={`button-stroke-color-${color}`}
                        />
                      ))}
                    </div>
                    <Input
                      type="color"
                      value={strokeColor}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      className="w-full h-9"
                      data-testid="input-stroke-color"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Fill Color
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={`w-7 h-7 rounded-md border-2 transition-all bg-transparent ${
                          fillColor === 'transparent' ? 'border-primary scale-110' : 'border-border'
                        }`}
                        onClick={() => setFillColor('transparent')}
                        data-testid="button-fill-transparent"
                      >
                        <span className="text-xs">No</span>
                      </button>
                      {colorPresets.map(color => (
                        <button
                          key={color}
                          className={`w-7 h-7 rounded-md border-2 transition-all ${
                            fillColor === color ? 'border-primary scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setFillColor(color)}
                          data-testid={`button-fill-color-${color}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Stroke Width
                      </Label>
                      <span className="text-xs text-muted-foreground">{strokeWidth}px</span>
                    </div>
                    <Slider
                      value={[strokeWidth]}
                      onValueChange={([value]) => setStrokeWidth(value)}
                      min={1}
                      max={20}
                      step={1}
                      data-testid="slider-stroke-width"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Opacity
                      </Label>
                      <span className="text-xs text-muted-foreground">{opacity}%</span>
                    </div>
                    <Slider
                      value={[opacity]}
                      onValueChange={([value]) => setOpacity(value)}
                      min={10}
                      max={100}
                      step={5}
                      data-testid="slider-opacity"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Line Style
                    </Label>
                    <Select value={lineStyle} onValueChange={(v) => setLineStyle(v as any)}>
                      <SelectTrigger data-testid="select-line-style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">Solid</SelectItem>
                        <SelectItem value="dashed">Dashed</SelectItem>
                        <SelectItem value="dotted">Dotted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Measurement Units
                    </Label>
                    <Select value={measurementUnit} onValueChange={(v) => setMeasurementUnit(v as any)}>
                      <SelectTrigger data-testid="select-measurement-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mm">Millimeters (mm)</SelectItem>
                        <SelectItem value="cm">Centimeters (cm)</SelectItem>
                        <SelectItem value="ft">Feet (ft)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="layers" className="flex-1 m-0">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-1">
                  {layers.map((layer) => (
                    <div
                      key={layer.id}
                      className={`flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer ${
                        layer.type === 'pdf' ? 'bg-muted/50' : ''
                      }`}
                      data-testid={`layer-${layer.id}`}
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => toggleLayerVisibility(layer.id)}
                        data-testid={`button-toggle-layer-${layer.id}`}
                      >
                        {layer.visible ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <span className="flex-1 text-sm truncate">{layer.name}</span>
                      {layer.type !== 'pdf' && (
                        <span className="text-xs text-muted-foreground">
                          {layer.shapes.length}
                        </span>
                      )}
                      {layer.locked && (
                        <span className="text-xs text-muted-foreground">Locked</span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}
