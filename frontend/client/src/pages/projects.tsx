import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Layers, Plus, FileText, ChevronDown, LogOut, ArrowLeft, Upload, Loader2 } from 'lucide-react';
import type { Project } from '@shared/schema';
import { format } from 'date-fns';

export default function ProjectsPage() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<'name' | 'upload'>('name');

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects', user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects?userId=${user?.id}`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    enabled: !!user?.id,
  });

  const createProjectMutation = useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File }) => {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('userId', user?.id || '');
      formData.append('pdf', file);

      const response = await fetch('/api/projects', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setShowNewProject(false);
      setProjectName('');
      setSelectedFile(null);
      setStep('name');
      setLocation(`/editor/${data.id}`);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create project. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Invalid file type',
          description: 'Please select a PDF file',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleCreateProject = async () => {
    if (!selectedFile || !projectName.trim()) return;
    setIsUploading(true);
    try {
      await createProjectMutation.mutateAsync({ name: projectName.trim(), file: selectedFile });
    } finally {
      setIsUploading(false);
    }
  };

  const draftProjects = projects.filter((p) => p.status === 'draft');
  const savedProjects = projects.filter((p) => p.status === 'saved');

  const ProjectCard = ({ project }: { project: Project }) => (
    <Card
      className="border-card-border bg-card cursor-pointer transition-all duration-200 hover-elevate"
      onClick={() => setLocation(`/editor/${project.id}`)}
      data-testid={`card-project-${project.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="p-2 bg-muted rounded-md">
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <Badge
            variant="secondary"
            className={
              project.status === 'draft'
                ? 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30'
                : 'bg-green-600/20 text-green-400 border-green-600/30'
            }
          >
            {project.status === 'draft' ? 'Draft' : 'Saved'}
          </Badge>
        </div>
        <h3 className="font-medium text-foreground mb-1 truncate" data-testid={`text-project-name-${project.id}`}>
          {project.name}
        </h3>
        <p className="text-xs text-muted-foreground">
          Last updated: {format(new Date(project.lastUpdated), 'MMM d, yyyy h:mm a')}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border flex items-center justify-between px-6 sticky top-0 bg-background z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/dashboard')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="p-1.5 bg-primary rounded-md">
            <Layers className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">KABS Annotation & Pricing AI</span>
        </div>

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
      </header>

      <main className="flex-1 p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-1">Projects</h1>
              <p className="text-muted-foreground text-sm">
                Manage your floor-plan annotations
              </p>
            </div>
            <Button onClick={() => setShowNewProject(true)} data-testid="button-new-project">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <Card className="border-card-border bg-card">
              <CardContent className="py-16 text-center">
                <div className="inline-flex p-4 bg-muted rounded-full mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">No projects yet</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Create your first project to start annotating floor-plan PDFs
                </p>
                <Button onClick={() => setShowNewProject(true)} data-testid="button-create-first">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {draftProjects.length > 0 && (
                <section>
                  <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                    Draft Projects
                    <Badge variant="secondary" className="text-xs">
                      {draftProjects.length}
                    </Badge>
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {draftProjects.map((project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                </section>
              )}

              {savedProjects.length > 0 && (
                <section>
                  <h2 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                    Saved Projects
                    <Badge variant="secondary" className="text-xs">
                      {savedProjects.length}
                    </Badge>
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {savedProjects.map((project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="py-4 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">© KABS Annotation & Pricing AI</p>
      </footer>

      <Dialog open={showNewProject} onOpenChange={(open) => {
        setShowNewProject(open);
        if (!open) {
          setStep('name');
          setProjectName('');
          setSelectedFile(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {step === 'name' ? 'Create New Project' : 'Upload PDF'}
            </DialogTitle>
            <DialogDescription>
              {step === 'name'
                ? 'Enter a name for your project'
                : 'Select a PDF file to annotate'}
            </DialogDescription>
          </DialogHeader>

          {step === 'name' ? (
            <>
              <div className="py-4">
                <Input
                  placeholder="Project name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  data-testid="input-project-name"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowNewProject(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep('upload')}
                  disabled={!projectName.trim()}
                  data-testid="button-next"
                >
                  Next
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="py-4">
                <label
                  htmlFor="pdf-upload"
                  className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-muted-foreground transition-colors"
                >
                  {selectedFile ? (
                    <div className="text-center">
                      <FileText className="w-10 h-10 text-primary mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">PDF files only</p>
                    </div>
                  )}
                  <input
                    id="pdf-upload"
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                    data-testid="input-pdf-upload"
                  />
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep('name')}>
                  Back
                </Button>
                <Button
                  onClick={handleCreateProject}
                  disabled={!selectedFile || isUploading}
                  data-testid="button-create"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
