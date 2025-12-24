import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Stage, Layer, Rect, Circle, Line, Arrow, Text, Transformer, Arc, Group } from 'react-konva';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  ArrowUp,
  ArrowDown,
  Cloud,
  Loader2,
  Menu,
  X,
  PanelRightClose,
  PanelRightOpen,
  Hand,
} from 'lucide-react';
import type { Project, AnnotationShape, LayerData } from '@shared/schema';
import Konva from 'konva';

type Tool = 'select' | 'pan' | 'freehand' | 'line' | 'arrow' | 'rect' | 'circle' | 'text' | 'measurement' | 'angle' | 'eraser';

const tools: { id: Tool; icon: typeof MousePointer2; label: string; shortcut: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select / Move', shortcut: 'V' },
  { id: 'pan', icon: Hand, label: 'Pan / Move Canvas', shortcut: 'H' },
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

const getToolIcon = (toolType: string) => {
  switch (toolType) {
    case 'freehand': return Pencil;
    case 'line': return Minus;
    case 'arrow': return ArrowRight;
    case 'rect': return Square;
    case 'circle': return CircleIcon;
    case 'text': return Type;
    case 'measurement': return Ruler;
    case 'angle': return TriangleRight;
    case 'pan': return Hand;
    default: return Layers;
  }
};

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textEditRef = useRef<HTMLTextAreaElement>(null);

  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [anglePoints, setAnglePoints] = useState<number[]>([]);
  const [anglePreviewPoint, setAnglePreviewPoint] = useState<{x: number, y: number} | null>(null);
  
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
  const [pageImage, setPageImage] = useState<HTMLImageElement | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  
  const [layers, setLayers] = useState<LayerData[]>([
    { id: 'pdf-background', name: 'PDF Background', type: 'pdf', visible: true, locked: true, shapes: [] },
    { id: 'annotations', name: 'Annotations', type: 'annotation', visible: true, locked: false, shapes: [] },
    { id: 'measurements', name: 'Measurements', type: 'measurement', visible: true, locked: false, shapes: [] },
  ]);
  
  const [history, setHistory] = useState<LayerData[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showToolbar, setShowToolbar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [textEditPosition, setTextEditPosition] = useState({ x: 0, y: 0 });

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<'png' | 'pdf'>('png');
  const [exportFilename, setExportFilename] = useState('');

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
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setShowRightPanel(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const loadPageImage = async () => {
      if (!params.id) return;
      
      setPageLoading(true);
      try {
        const response = await fetch(`/api/projects/${params.id}/pages/${currentPage}`);
        if (!response.ok) {
          throw new Error('Failed to load page');
        }
        
        const data = await response.json();
        setTotalPages(data.totalPages || 1);
        
        if (data.imageUrl) {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.src = data.imageUrl;
          img.onload = () => {
            setPageImage(img);
            fitToScreen(img.width, img.height);
            setPageLoading(false);
          };
          img.onerror = () => {
            console.error('Failed to load page image');
            setPageLoading(false);
            toast({
              title: 'Error',
              description: 'Failed to load page image.',
              variant: 'destructive',
            });
          };
        } else {
          setPageLoading(false);
        }
      } catch (error) {
        console.error('Failed to load page:', error);
        setPageLoading(false);
        toast({
          title: 'Error',
          description: 'Failed to load page. Please try again.',
          variant: 'destructive',
        });
      }
    };

    loadPageImage();
  }, [params.id, currentPage, toast]);

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
        const rect = containerRef.current.getBoundingClientRect();
        setStageSize({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', () => {
      setTimeout(updateSize, 100);
    });
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, [showRightPanel, showToolbar]);

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

      if (e.key === 'Escape') {
        setSelectedShapeId(null);
        setEditingTextId(null);
        transformerRef.current?.nodes([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId]);

  const fitToScreen = useCallback((imgWidth?: number, imgHeight?: number) => {
    if (!containerRef.current) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const containerHeight = containerRef.current.offsetHeight;
    const width = imgWidth || pageImage?.width || 800;
    const height = imgHeight || pageImage?.height || 600;
    
    const scaleX = containerWidth / width;
    const scaleY = containerHeight / height;
    const newZoom = Math.min(scaleX, scaleY) * 0.95;
    
    setZoom(newZoom);
    setStagePosition({
      x: (containerWidth - width * newZoom) / 2,
      y: (containerHeight - height * newZoom) / 2,
    });
  }, [pageImage]);

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

  const toggleShapeVisibility = (shapeId: string) => {
    const newLayers = layers.map(layer => ({
      ...layer,
      shapes: layer.shapes.map(shape => 
        shape.id === shapeId ? { ...shape, visible: !shape.visible } : shape
      ),
    }));
    setLayers(newLayers);
    triggerAutoSave();
  };

  const moveShapeInLayer = (shapeId: string, direction: 'up' | 'down') => {
    const newLayers = layers.map(layer => {
      const shapeIndex = layer.shapes.findIndex(s => s.id === shapeId);
      if (shapeIndex === -1) return layer;
      
      const newShapes = [...layer.shapes];
      const targetIndex = direction === 'up' ? shapeIndex + 1 : shapeIndex - 1;
      
      if (targetIndex < 0 || targetIndex >= newShapes.length) return layer;
      
      [newShapes[shapeIndex], newShapes[targetIndex]] = [newShapes[targetIndex], newShapes[shapeIndex]];
      return { ...layer, shapes: newShapes };
    });
    setLayers(newLayers);
    addToHistory(newLayers);
    triggerAutoSave();
  };

  const getPointerPosition = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return null;
    
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    
    return {
      x: (pos.x - stagePosition.x) / zoom,
      y: (pos.y - stagePosition.y) / zoom,
    };
  };

  const handlePointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (editingTextId) {
      finishTextEditing();
      return;
    }

    if (activeTool === 'select' || activeTool === 'pan') {
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

    const pos = getPointerPosition(e);
    if (!pos) return;

    if (activeTool === 'angle') {
      if (anglePoints.length < 6) {
        setAnglePoints([...anglePoints, pos.x, pos.y]);
      }
      return;
    }

    setIsDrawing(true);

    if (activeTool === 'freehand') {
      setCurrentPoints([pos.x, pos.y]);
    } else if (activeTool === 'text') {
      const newId = generateId();
      const shape: AnnotationShape = {
        id: newId,
        type: 'text',
        x: pos.x,
        y: pos.y,
        text: '',
        fontSize: 16,
        strokeColor,
        fillColor,
        strokeWidth,
        opacity: opacity / 100,
        lineStyle,
        visible: true,
        locked: false,
        name: `text ${Date.now()}`,
      };
      addShape(shape);
      setIsDrawing(false);
      setSelectedShapeId(newId);
      
      const stage = stageRef.current;
      if (stage) {
        const stageBox = stage.container().getBoundingClientRect();
        setTextEditPosition({
          x: stageBox.left + pos.x * zoom + stagePosition.x,
          y: stageBox.top + pos.y * zoom + stagePosition.y,
        });
        setEditingTextId(newId);
        setEditingTextValue('');
        setTimeout(() => {
          textEditRef.current?.focus();
        }, 0);
      }
    } else {
      setCurrentPoints([pos.x, pos.y, pos.x, pos.y]);
    }
  };

  const handlePointerMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition(e);
    if (!pos) return;

    if (activeTool === 'angle' && anglePoints.length >= 2) {
      setAnglePreviewPoint({ x: pos.x, y: pos.y });
      return;
    }

    if (!isDrawing) return;

    if (activeTool === 'freehand') {
      const lastX = currentPoints[currentPoints.length - 2];
      const lastY = currentPoints[currentPoints.length - 1];
      const dist = Math.sqrt(Math.pow(pos.x - lastX, 2) + Math.pow(pos.y - lastY, 2));
      if (dist > 3) {
        setCurrentPoints([...currentPoints, pos.x, pos.y]);
      }
    } else {
      const newPoints = [...currentPoints];
      newPoints[2] = pos.x;
      newPoints[3] = pos.y;
      setCurrentPoints(newPoints);
    }
  };

  const handlePointerUp = () => {
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
    }

    if (shape) {
      addShape(shape);
    }

    setIsDrawing(false);
    setCurrentPoints([]);
  };

  useEffect(() => {
    if (anglePoints.length === 6) {
      const [x1, y1, x2, y2, x3, y3] = anglePoints;
      
      const v1x = x1 - x2;
      const v1y = y1 - y2;
      const v2x = x3 - x2;
      const v2y = y3 - y2;
      
      const dot = v1x * v2x + v1y * v2y;
      const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
      const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
      
      let angleDegrees = 0;
      if (mag1 > 0 && mag2 > 0) {
        const cosAngle = dot / (mag1 * mag2);
        angleDegrees = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
      }

      const shape: AnnotationShape = {
        id: generateId(),
        type: 'angle',
        x: x2,
        y: y2,
        points: anglePoints,
        angleValue: angleDegrees,
        strokeColor,
        fillColor,
        strokeWidth,
        opacity: opacity / 100,
        lineStyle,
        visible: true,
        locked: false,
        name: `angle ${Date.now()}`,
      };
      
      addShape(shape);
      setAnglePoints([]);
      setAnglePreviewPoint(null);
    }
  }, [anglePoints, strokeColor, fillColor, strokeWidth, opacity, lineStyle]);

  const handleShapeClick = (shapeId: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
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

  const handleTextDblClick = (shapeId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    const textNode = e.target as Konva.Text;
    const shape = layers.flatMap(l => l.shapes).find(s => s.id === shapeId);
    if (!shape || shape.type !== 'text') return;

    setEditingTextId(shapeId);
    setEditingTextValue(shape.text || '');

    const stage = stageRef.current;
    if (!stage) return;

    const textPosition = textNode.getAbsolutePosition();
    const stageBox = stage.container().getBoundingClientRect();

    setTextEditPosition({
      x: stageBox.left + textPosition.x,
      y: stageBox.top + textPosition.y,
    });

    transformerRef.current?.nodes([]);
    
    setTimeout(() => {
      textEditRef.current?.focus();
      textEditRef.current?.select();
    }, 0);
  };

  const finishTextEditing = () => {
    if (editingTextId && editingTextValue.trim()) {
      updateShape(editingTextId, { text: editingTextValue });
    }
    setEditingTextId(null);
    setEditingTextValue('');
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

  const openExportDialog = (type: 'png' | 'pdf') => {
    setExportType(type);
    setExportFilename(project?.name || 'annotation');
    setExportDialogOpen(true);
  };

  const handleExportConfirm = async () => {
    setExportDialogOpen(false);
    if (exportType === 'png') {
      await performExportCurrentPage();
    } else {
      await performExportAllPages();
    }
  };

  const performExportCurrentPage = async () => {
    if (!stageRef.current || !pageImage) {
      toast({
        title: 'Export failed',
        description: 'No content to export.',
        variant: 'destructive',
      });
      return;
    }

    try {
      transformerRef.current?.nodes([]);
      setSelectedShapeId(null);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stage = stageRef.current;
      const originalScale = { x: stage.scaleX(), y: stage.scaleY() };
      const originalPosition = { x: stage.x(), y: stage.y() };
      
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      
      stage.batchDraw();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const dataURL = stage.toDataURL({
        mimeType: 'image/png',
        quality: 1,
        pixelRatio: 2,
        x: 0,
        y: 0,
        width: pageImage.width,
        height: pageImage.height,
      });
      
      stage.scale(originalScale);
      stage.position(originalPosition);
      
      const byteString = atob(dataURL.split(',')[1]);
      const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.download = `${exportFilename}-page-${currentPage}.png`;
      link.href = blobUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 100);

      toast({
        title: 'Export successful',
        description: `Page ${currentPage} exported as PNG with annotations.`,
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export the annotation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const renderAnnotationsToCanvas = (ctx: CanvasRenderingContext2D, pageAnnotations: LayerData[]) => {
    pageAnnotations.forEach(layer => {
      if (layer.visible && layer.type !== 'pdf') {
        layer.shapes.forEach(shape => {
          if (shape.visible) {
            ctx.save();
            ctx.globalAlpha = shape.opacity || 1;
            ctx.strokeStyle = shape.strokeColor || '#000';
            ctx.fillStyle = shape.fillColor || 'transparent';
            ctx.lineWidth = shape.strokeWidth || 2;
            
            if (shape.lineStyle === 'dashed') {
              ctx.setLineDash([10, 5]);
            } else if (shape.lineStyle === 'dotted') {
              ctx.setLineDash([2, 4]);
            }
            
            switch (shape.type) {
              case 'rect':
                if (shape.fillColor && shape.fillColor !== 'transparent') {
                  ctx.fillRect(shape.x || 0, shape.y || 0, shape.width || 0, shape.height || 0);
                }
                ctx.strokeRect(shape.x || 0, shape.y || 0, shape.width || 0, shape.height || 0);
                break;
              case 'circle':
                ctx.beginPath();
                ctx.arc(shape.x || 0, shape.y || 0, shape.radius || 0, 0, Math.PI * 2);
                if (shape.fillColor && shape.fillColor !== 'transparent') {
                  ctx.fill();
                }
                ctx.stroke();
                break;
              case 'line':
              case 'freehand':
                if (shape.points && shape.points.length >= 2) {
                  ctx.beginPath();
                  ctx.moveTo(shape.points[0], shape.points[1]);
                  for (let i = 2; i < shape.points.length; i += 2) {
                    ctx.lineTo(shape.points[i], shape.points[i+1]);
                  }
                  if (shape.points.length === 2) {
                    ctx.lineTo(shape.points[0] + 1, shape.points[1]);
                  }
                  ctx.stroke();
                }
                break;
              case 'arrow':
                if (shape.points && shape.points.length >= 4) {
                  const [x1, y1, x2, y2] = shape.points;
                  ctx.beginPath();
                  ctx.moveTo(x1, y1);
                  ctx.lineTo(x2, y2);
                  ctx.stroke();
                  
                  const arrowAngle = Math.atan2(y2 - y1, x2 - x1);
                  const headLength = 15;
                  ctx.beginPath();
                  ctx.moveTo(x2, y2);
                  ctx.lineTo(x2 - headLength * Math.cos(arrowAngle - Math.PI / 6), y2 - headLength * Math.sin(arrowAngle - Math.PI / 6));
                  ctx.moveTo(x2, y2);
                  ctx.lineTo(x2 - headLength * Math.cos(arrowAngle + Math.PI / 6), y2 - headLength * Math.sin(arrowAngle + Math.PI / 6));
                  ctx.stroke();
                }
                break;
              case 'text':
                ctx.font = `${shape.fontSize || 16}px sans-serif`;
                ctx.fillStyle = shape.strokeColor || '#000';
                ctx.fillText(shape.text || '', shape.x || 0, (shape.y || 0) + (shape.fontSize || 16));
                break;
              case 'measurement':
                if (shape.points && shape.points.length >= 4) {
                  const [mx1, my1, mx2, my2] = shape.points;
                  ctx.beginPath();
                  ctx.moveTo(mx1, my1);
                  ctx.lineTo(mx2, my2);
                  ctx.stroke();
                  const midX = (mx1 + mx2) / 2;
                  const midY = (my1 + my2) / 2;
                  const dist = Math.sqrt(Math.pow(mx2 - mx1, 2) + Math.pow(my2 - my1, 2));
                  ctx.font = '12px sans-serif';
                  ctx.fillStyle = shape.strokeColor || '#000';
                  ctx.fillText(`${dist.toFixed(1)} ${shape.measurementUnit || 'px'}`, midX, midY - 10);
                }
                break;
              case 'angle':
                if (shape.points && shape.points.length >= 6) {
                  const [ax1, ay1, ax2, ay2, ax3, ay3] = shape.points;
                  ctx.beginPath();
                  ctx.moveTo(ax1, ay1);
                  ctx.lineTo(ax2, ay2);
                  ctx.lineTo(ax3, ay3);
                  ctx.stroke();
                  
                  const angle1 = Math.atan2(ay1 - ay2, ax1 - ax2);
                  const angle2 = Math.atan2(ay3 - ay2, ax3 - ax2);
                  const startAngle = Math.min(angle1, angle2);
                  let sweepAngle = Math.abs(angle2 - angle1);
                  if (sweepAngle > Math.PI) sweepAngle = 2 * Math.PI - sweepAngle;
                  ctx.beginPath();
                  ctx.arc(ax2, ay2, 25, startAngle, startAngle + sweepAngle);
                  ctx.stroke();
                  
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
                  ctx.beginPath();
                  ctx.roundRect(ax2 + 30, ay2 - 22, 60, 24, 4);
                  ctx.fill();
                  
                  ctx.font = 'bold 16px JetBrains Mono, monospace';
                  ctx.fillStyle = '#ffffff';
                  ctx.fillText(`${(shape.angleValue || 0).toFixed(1)}°`, ax2 + 35, ay2 - 4);
                }
                break;
            }
            ctx.restore();
          }
        });
      }
    });
  };

  const performExportAllPages = async () => {
    if (!params.id || !stageRef.current) {
      toast({
        title: 'Export failed',
        description: 'No project to export.',
        variant: 'destructive',
      });
      return;
    }

    const stage = stageRef.current;
    const originalScale = { x: stage.scaleX(), y: stage.scaleY() };
    const originalPosition = { x: stage.x(), y: stage.y() };

    try {
      toast({
        title: 'Exporting...',
        description: 'Preparing PDF export with annotations. This may take a moment.',
      });

      transformerRef.current?.nodes([]);
      setSelectedShapeId(null);

      const { jsPDF } = await import('jspdf');
      
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const currentDataURL = stage.toDataURL({
        mimeType: 'image/png',
        quality: 1,
        pixelRatio: 2,
        x: 0,
        y: 0,
        width: pageImage?.width || 800,
        height: pageImage?.height || 600,
      });
      
      stage.scale(originalScale);
      stage.position(originalPosition);
      
      let pdf: InstanceType<typeof jsPDF> | null = null;
      
      for (let page = 1; page <= totalPages; page++) {
        let pageDataURL: string;
        let imgWidth: number;
        let imgHeight: number;
        
        if (page === currentPage) {
          pageDataURL = currentDataURL;
          imgWidth = pageImage?.width || 800;
          imgHeight = pageImage?.height || 600;
        } else {
          const imgResponse = await fetch(`/api/projects/${params.id}/pages/${page}`);
          const imgData = await imgResponse.json();
          
          if (!imgData.imageUrl) continue;
          
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imgData.imageUrl;
          });
          
          const annotResponse = await fetch(`/api/annotations/${params.id}/${page}`);
          let pageAnnotations: LayerData[] = [];
          if (annotResponse.ok) {
            const annotData = await annotResponse.json();
            if (annotData && annotData.data) {
              pageAnnotations = annotData.data;
            }
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) continue;
          
          ctx.drawImage(img, 0, 0);
          renderAnnotationsToCanvas(ctx, pageAnnotations);
          
          pageDataURL = canvas.toDataURL('image/png', 1);
          imgWidth = img.width;
          imgHeight = img.height;
        }
        
        const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
        
        if (!pdf) {
          pdf = new jsPDF({
            orientation,
            unit: 'pt',
            format: [imgWidth, imgHeight]
          });
        } else {
          pdf.addPage([imgWidth, imgHeight], orientation);
        }
        
        pdf.addImage(pageDataURL, 'PNG', 0, 0, imgWidth, imgHeight);
      }

      if (pdf) {
        pdf.save(`${exportFilename}-all-pages.pdf`);
        toast({
          title: 'Export successful',
          description: `All ${totalPages} pages exported as PDF with annotations.`,
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      stage.scale(originalScale);
      stage.position(originalPosition);
    }
  };

  const toggleLayerVisibility = (layerId: string) => {
    const newLayers = layers.map(layer => 
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    );
    setLayers(newLayers);
    triggerAutoSave();
  };

  const getLineStyleDash = (style: string): number[] => {
    switch (style) {
      case 'dashed': return [10, 5];
      case 'dotted': return [2, 4];
      default: return [];
    }
  };

  const getAllShapes = () => {
    return layers
      .filter(layer => layer.type !== 'pdf')
      .flatMap(layer => layer.shapes.map(shape => ({ ...shape, layerId: layer.id })));
  };

  const renderShape = (shape: AnnotationShape) => {
    const commonProps = {
      id: shape.id,
      opacity: shape.opacity,
      visible: shape.visible,
      draggable: activeTool === 'select' && !shape.locked,
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => handleShapeClick(shape.id, e),
      onTap: (e: Konva.KonvaEventObject<TouchEvent>) => handleShapeClick(shape.id, e),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        updateShape(shape.id, { x: e.target.x(), y: e.target.y() });
      },
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
        const node = e.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        
        node.scaleX(1);
        node.scaleY(1);
        
        updateShape(shape.id, {
          x: node.x(),
          y: node.y(),
          width: Math.max(5, (shape.width || 0) * scaleX),
          height: Math.max(5, (shape.height || 0) * scaleY),
          radius: shape.radius ? Math.max(5, shape.radius * Math.max(scaleX, scaleY)) : undefined,
          fontSize: shape.fontSize ? Math.max(8, (shape.fontSize || 16) * scaleY) : undefined,
          rotation: node.rotation(),
        });
      },
    };

    switch (shape.type) {
      case 'rect':
        return (
          <Rect
            key={shape.id}
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
            key={shape.id}
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
            key={shape.id}
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
            key={shape.id}
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
            key={shape.id}
            {...commonProps}
            x={shape.x}
            y={shape.y}
            text={editingTextId === shape.id ? '' : (shape.text || 'Text')}
            fontSize={shape.fontSize || 16}
            fill={shape.strokeColor}
            fontFamily="Inter, sans-serif"
            onDblClick={(e) => handleTextDblClick(shape.id, e)}
            onDblTap={(e) => handleTextDblClick(shape.id, e as any)}
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
          <Group key={shape.id}>
            <Line
              {...commonProps}
              points={points}
              stroke={shape.strokeColor}
              strokeWidth={shape.strokeWidth}
              dash={[5, 5]}
            />
            <Text
              x={midX - 30}
              y={midY - 20}
              text={`${displayValue} ${unitLabel}`}
              fontSize={14}
              fill={shape.strokeColor}
              fontFamily="JetBrains Mono, monospace"
              align="center"
              listening={false}
            />
          </Group>
        );
      case 'angle':
        if (!shape.points || shape.points.length < 6) return null;
        const [x1, y1, x2, y2, x3, y3] = shape.points;
        const angleDeg = shape.angleValue || 0;
        
        const angle1 = Math.atan2(y1 - y2, x1 - x2);
        const angle2 = Math.atan2(y3 - y2, x3 - x2);
        
        const startAngle = Math.min(angle1, angle2);
        const endAngle = Math.max(angle1, angle2);
        let sweepAngle = endAngle - startAngle;
        if (sweepAngle > Math.PI) sweepAngle = 2 * Math.PI - sweepAngle;
        
        return (
          <Group key={shape.id}>
            <Line
              {...commonProps}
              points={[x1, y1, x2, y2]}
              stroke={shape.strokeColor}
              strokeWidth={shape.strokeWidth}
            />
            <Line
              points={[x2, y2, x3, y3]}
              stroke={shape.strokeColor}
              strokeWidth={shape.strokeWidth}
              listening={false}
            />
            <Arc
              x={x2}
              y={y2}
              innerRadius={25}
              outerRadius={25}
              angle={sweepAngle * (180 / Math.PI)}
              rotation={startAngle * (180 / Math.PI)}
              stroke={shape.strokeColor}
              strokeWidth={1}
              listening={false}
            />
            <Rect
              x={x2 + 30}
              y={y2 - 22}
              width={60}
              height={24}
              fill="rgba(0, 0, 0, 0.75)"
              cornerRadius={4}
              listening={false}
            />
            <Text
              x={x2 + 35}
              y={y2 - 18}
              text={`${angleDeg.toFixed(1)}°`}
              fontSize={16}
              fill="#ffffff"
              fontFamily="JetBrains Mono, monospace"
              fontStyle="bold"
              listening={false}
            />
          </Group>
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
              x={midX - 30}
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

  const renderAnglePreview = () => {
    if (anglePoints.length < 2) return null;

    const previewProps = {
      stroke: strokeColor,
      strokeWidth,
      opacity: opacity / 100,
      listening: false,
    };

    if (anglePoints.length === 2 && anglePreviewPoint) {
      return (
        <>
          <Line
            points={[anglePoints[0], anglePoints[1], anglePreviewPoint.x, anglePreviewPoint.y]}
            {...previewProps}
            dash={[5, 5]}
          />
          <Circle
            x={anglePoints[0]}
            y={anglePoints[1]}
            radius={5}
            fill={strokeColor}
            listening={false}
          />
          <Circle
            x={anglePreviewPoint.x}
            y={anglePreviewPoint.y}
            radius={4}
            fill={strokeColor}
            opacity={0.5}
            listening={false}
          />
        </>
      );
    }

    if (anglePoints.length === 2) {
      return (
        <Circle
          x={anglePoints[0]}
          y={anglePoints[1]}
          radius={5}
          fill={strokeColor}
          {...previewProps}
        />
      );
    }

    if (anglePoints.length === 4) {
      const [x1, y1, x2, y2] = anglePoints;
      const x3 = anglePreviewPoint?.x ?? x2;
      const y3 = anglePreviewPoint?.y ?? y2;
      
      const v1x = x1 - x2;
      const v1y = y1 - y2;
      const v2x = x3 - x2;
      const v2y = y3 - y2;
      
      const dot = v1x * v2x + v1y * v2y;
      const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
      const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
      
      let previewAngle = 0;
      if (mag1 > 0 && mag2 > 0) {
        const cosAngle = dot / (mag1 * mag2);
        previewAngle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
      }
      
      const angle1 = Math.atan2(y1 - y2, x1 - x2);
      const angle2 = Math.atan2(y3 - y2, x3 - x2);
      const startAngle = Math.min(angle1, angle2);
      let sweepAngle = Math.abs(angle2 - angle1);
      if (sweepAngle > Math.PI) sweepAngle = 2 * Math.PI - sweepAngle;
      
      return (
        <>
          <Line
            points={[x1, y1, x2, y2]}
            {...previewProps}
          />
          <Line
            points={[x2, y2, x3, y3]}
            {...previewProps}
            dash={anglePreviewPoint ? [5, 5] : undefined}
          />
          <Arc
            x={x2}
            y={y2}
            innerRadius={25}
            outerRadius={25}
            angle={sweepAngle * (180 / Math.PI)}
            rotation={startAngle * (180 / Math.PI)}
            stroke={strokeColor}
            strokeWidth={1}
            listening={false}
          />
          <Rect
            x={x2 + 30}
            y={y2 - 22}
            width={60}
            height={24}
            fill="rgba(0, 0, 0, 0.75)"
            cornerRadius={4}
            listening={false}
          />
          <Text
            x={x2 + 35}
            y={y2 - 18}
            text={`${previewAngle.toFixed(1)}°`}
            fontSize={16}
            fill="#ffffff"
            fontFamily="JetBrains Mono, monospace"
            fontStyle="bold"
            listening={false}
          />
          <Circle
            x={x2}
            y={y2}
            radius={5}
            fill={strokeColor}
            listening={false}
          />
          {anglePreviewPoint && (
            <Circle
              x={x3}
              y={y3}
              radius={4}
              fill={strokeColor}
              opacity={0.5}
              listening={false}
            />
          )}
        </>
      );
    }

    return null;
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
      <header className="h-12 md:h-14 border-b border-border flex items-center justify-between px-2 md:px-4 shrink-0 bg-background">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/projects')}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowToolbar(!showToolbar)}
              data-testid="button-toggle-toolbar"
            >
              {showToolbar ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          )}
          
          <div className="hidden md:flex p-1.5 bg-primary rounded-md">
            <Layers className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-medium text-foreground text-sm truncate max-w-[120px] md:max-w-none">
            {project?.name || 'Untitled'}
          </span>
          
          <div className="hidden sm:flex items-center gap-1 ml-2 md:ml-4 text-xs text-muted-foreground">
            {autoSaveStatus === 'saving' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden md:inline">Saving...</span>
              </>
            ) : autoSaveStatus === 'saved' ? (
              <>
                <Cloud className="w-3 h-3 text-green-500" />
                <span className="hidden md:inline">Auto-saved</span>
              </>
            ) : (
              <>
                <Cloud className="w-3 h-3 text-yellow-500" />
                <span className="hidden md:inline">Unsaved</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          <div className="hidden sm:flex items-center gap-1">
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
          </div>
          
          <Separator orientation="vertical" className="h-6 mx-1 md:mx-2 hidden sm:block" />
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveProject}
            disabled={saveProjectMutation.isPending}
            className="hidden md:flex"
            data-testid="button-save"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Project
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSaveProject}
            disabled={saveProjectMutation.isPending}
            className="md:hidden"
            data-testid="button-save-mobile"
          >
            <Save className="h-4 w-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="hidden md:flex gap-1"
                data-testid="button-export"
              >
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openExportDialog('png')} data-testid="button-export-png">
                <Download className="mr-2 h-4 w-4" />
                Current Page (PNG)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openExportDialog('pdf')} data-testid="button-export-pdf">
                <Download className="mr-2 h-4 w-4" />
                All Pages (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden"
                data-testid="button-export-mobile"
              >
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openExportDialog('png')}>
                Current Page (PNG)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openExportDialog('pdf')}>
                All Pages (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Separator orientation="vertical" className="h-6 mx-1 md:mx-2 hidden md:block" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowRightPanel(!showRightPanel)}
            className="hidden md:flex"
            data-testid="button-toggle-panel"
          >
            {showRightPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 md:gap-2" data-testid="button-user-menu">
                <span className="text-xs md:text-sm hidden sm:inline">Hello, {user?.name}</span>
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

      <div className="flex-1 flex overflow-hidden relative">
        {(showToolbar || !isMobile) && (
          <aside className={`${isMobile ? 'absolute left-0 top-0 bottom-0 z-20 shadow-lg' : ''} w-14 md:w-16 border-r border-border bg-card shrink-0 flex flex-col py-2`}>
            <ScrollArea className="flex-1">
              <div className="flex flex-col">
                {tools.map((tool, index) => (
                  <div key={tool.id}>
                    {index === 7 && <Separator className="my-2" />}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={activeTool === tool.id ? 'secondary' : 'ghost'}
                          size="icon"
                          className="w-10 h-10 md:w-12 md:h-12 mx-auto my-0.5"
                          onClick={() => {
                            setActiveTool(tool.id);
                            if (isMobile) setShowToolbar(false);
                          }}
                          data-testid={`button-tool-${tool.id}`}
                        >
                          <tool.icon className="h-4 w-4 md:h-5 md:w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{tool.label}</p>
                        <p className="text-xs text-muted-foreground">Shortcut: {tool.shortcut}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </aside>
        )}

        <main 
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-muted/30"
          style={{ cursor: activeTool === 'pan' ? 'grab' : activeTool === 'select' ? 'default' : 'crosshair' }}
        >
          {pageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            x={stagePosition.x}
            y={stagePosition.y}
            scaleX={zoom}
            scaleY={zoom}
            onWheel={handleWheel}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            draggable={activeTool === 'pan' && !isDrawing}
            onDragEnd={(e) => {
              setStagePosition({
                x: e.target.x(),
                y: e.target.y(),
              });
            }}
          >
            <Layer>
              {pageImage && (
                <Rect
                  id="pdf-image"
                  x={0}
                  y={0}
                  width={pageImage.width}
                  height={pageImage.height}
                  fillPatternImage={pageImage}
                  listening={false}
                />
              )}
            </Layer>
            
            {layers.filter(layer => layer.visible && layer.type !== 'pdf').map(layer => (
              <Layer key={layer.id}>
                {layer.shapes.filter(s => s.visible).map(renderShape)}
              </Layer>
            ))}
            
            <Layer>
              {renderDrawingPreview()}
              {renderAnglePreview()}
              <Transformer 
                ref={transformerRef}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 5 || newBox.height < 5) {
                    return oldBox;
                  }
                  return newBox;
                }}
              />
            </Layer>
          </Stage>

          {editingTextId && (
            <textarea
              ref={textEditRef}
              value={editingTextValue}
              onChange={(e) => setEditingTextValue(e.target.value)}
              onBlur={finishTextEditing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  finishTextEditing();
                }
                if (e.key === 'Escape') {
                  setEditingTextId(null);
                  setEditingTextValue('');
                }
              }}
              style={{
                position: 'fixed',
                left: textEditPosition.x,
                top: textEditPosition.y,
                fontSize: '16px',
                padding: '4px 8px',
                margin: 0,
                border: '2px solid #3b82f6',
                borderRadius: '4px',
                background: 'white',
                color: 'black',
                resize: 'none',
                outline: 'none',
                minWidth: '150px',
                minHeight: '40px',
                zIndex: 1000,
                fontFamily: 'Inter, sans-serif',
              }}
              data-testid="textarea-text-edit"
            />
          )}

          <div className="absolute bottom-14 md:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 md:gap-2 bg-card border border-border rounded-md px-2 md:px-3 py-1.5 md:py-2 shadow-lg z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs md:text-sm font-mono min-w-[50px] md:min-w-[60px] text-center" data-testid="text-page-number">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="absolute bottom-14 md:bottom-4 right-2 md:right-4 flex items-center gap-1 bg-card border border-border rounded-md p-1 shadow-lg z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono min-w-[40px] md:min-w-[50px] text-center" data-testid="text-zoom-level">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(Math.min(5, zoom + 0.1))}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => fitToScreen()}
              data-testid="button-fit-screen"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>

          {isMobile && (
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-2 z-10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRightPanel(!showRightPanel)}
                data-testid="button-toggle-panel-mobile"
              >
                {showRightPanel ? 'Hide Panel' : 'Properties'}
              </Button>
            </div>
          )}
        </main>

        {showRightPanel && (
          <aside className={`${isMobile ? 'absolute right-0 top-0 bottom-0 z-20 shadow-lg' : ''} w-64 md:w-72 border-l border-border bg-card shrink-0 flex flex-col`}>
            <Tabs defaultValue="properties" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2 rounded-none border-b border-border shrink-0">
                <TabsTrigger value="properties">Properties</TabsTrigger>
                <TabsTrigger value="layers">Layers</TabsTrigger>
              </TabsList>
              
              <TabsContent value="properties" className="flex-1 m-0 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-3 md:p-4 space-y-4 md:space-y-6">
                    <div className="space-y-2 md:space-y-3">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Stroke Color
                      </Label>
                      <div className="flex flex-wrap gap-1.5 md:gap-2">
                        {colorPresets.map(color => (
                          <button
                            key={color}
                            className={`w-6 h-6 md:w-7 md:h-7 rounded-md border-2 transition-all ${
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
                        className="w-full h-8 md:h-9"
                        data-testid="input-stroke-color"
                      />
                    </div>

                    <div className="space-y-2 md:space-y-3">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Fill Color
                      </Label>
                      <div className="flex flex-wrap gap-1.5 md:gap-2">
                        <button
                          className={`w-6 h-6 md:w-7 md:h-7 rounded-md border-2 transition-all bg-transparent ${
                            fillColor === 'transparent' ? 'border-primary scale-110' : 'border-border'
                          }`}
                          onClick={() => setFillColor('transparent')}
                          data-testid="button-fill-transparent"
                        >
                          <span className="text-[10px] md:text-xs">No</span>
                        </button>
                        {colorPresets.map(color => (
                          <button
                            key={color}
                            className={`w-6 h-6 md:w-7 md:h-7 rounded-md border-2 transition-all ${
                              fillColor === color ? 'border-primary scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setFillColor(color)}
                            data-testid={`button-fill-color-${color}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 md:space-y-3">
                      <div className="flex items-center justify-between gap-2">
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

                    <div className="space-y-2 md:space-y-3">
                      <div className="flex items-center justify-between gap-2">
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

                    <div className="space-y-2 md:space-y-3">
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

                    <div className="space-y-2 md:space-y-3">
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
              
              <TabsContent value="layers" className="flex-1 m-0 min-h-0">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-1">
                    {layers.map((layer) => (
                      <div key={layer.id} className="space-y-1">
                        <div
                          className={`flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer ${
                            layer.type === 'pdf' ? 'bg-muted/50' : ''
                          }`}
                          data-testid={`layer-${layer.id}`}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 md:h-7 md:w-7"
                            onClick={() => toggleLayerVisibility(layer.id)}
                            data-testid={`button-toggle-layer-${layer.id}`}
                          >
                            {layer.visible ? (
                              <Eye className="h-3 w-3 md:h-4 md:w-4" />
                            ) : (
                              <EyeOff className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <span className="flex-1 text-xs md:text-sm truncate">{layer.name}</span>
                          {layer.type !== 'pdf' && (
                            <span className="text-xs text-muted-foreground">
                              {layer.shapes.length}
                            </span>
                          )}
                        </div>
                        
                        {layer.type !== 'pdf' && layer.shapes.length > 0 && (
                          <div className="ml-4 md:ml-6 space-y-0.5">
                            {layer.shapes.map((shape, index) => {
                              const ToolIcon = getToolIcon(shape.type);
                              return (
                                <div
                                  key={shape.id}
                                  className={`flex items-center gap-1 md:gap-2 p-1.5 md:p-2 rounded-md text-xs md:text-sm hover-elevate ${
                                    selectedShapeId === shape.id ? 'bg-accent' : ''
                                  }`}
                                  onClick={() => setSelectedShapeId(shape.id)}
                                  data-testid={`shape-${shape.id}`}
                                >
                                  <ToolIcon className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground shrink-0" />
                                  <span className="flex-1 truncate capitalize">{shape.type}</span>
                                  
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 md:h-6 md:w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveShapeInLayer(shape.id, 'up');
                                      }}
                                      disabled={index === layer.shapes.length - 1}
                                      data-testid={`button-move-up-${shape.id}`}
                                    >
                                      <ArrowUp className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 md:h-6 md:w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        moveShapeInLayer(shape.id, 'down');
                                      }}
                                      disabled={index === 0}
                                      data-testid={`button-move-down-${shape.id}`}
                                    >
                                      <ArrowDown className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 md:h-6 md:w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleShapeVisibility(shape.id);
                                      }}
                                      data-testid={`button-toggle-shape-${shape.id}`}
                                    >
                                      {shape.visible ? (
                                        <Eye className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                      ) : (
                                        <EyeOff className="h-2.5 w-2.5 md:h-3 md:w-3 text-muted-foreground" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 md:h-6 md:w-6 text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteShape(shape.id);
                                      }}
                                      data-testid={`button-delete-${shape.id}`}
                                    >
                                      <Trash2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </aside>
        )}
      </div>

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export {exportType === 'png' ? 'Current Page as PNG' : 'All Pages as PDF'}</DialogTitle>
            <DialogDescription>
              Enter a filename for your export. The file extension will be added automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="export-filename">Filename</Label>
              <Input
                id="export-filename"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                placeholder="Enter filename"
                data-testid="input-export-filename"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {exportType === 'png' 
                ? `Will save as: ${exportFilename}-page-${currentPage}.png`
                : `Will save as: ${exportFilename}-all-pages.pdf`
              }
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)} data-testid="button-export-cancel">
              Cancel
            </Button>
            <Button onClick={handleExportConfirm} disabled={!exportFilename.trim()} data-testid="button-export-confirm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
