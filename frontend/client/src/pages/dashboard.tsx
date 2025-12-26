import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Layers, FileEdit, Sparkles, ChevronDown, LogOut } from 'lucide-react';

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  const modules = [
    {
      id: 'annotation',
      title: 'Annotation',
      description: 'Upload floor-plan PDFs and add professional annotations, measurements, and comments',
      icon: FileEdit,
      status: 'active' as const,
      path: '/projects',
    },
    {
      id: 'pricing-ai',
      title: 'Pricing AI',
      description: 'AI-powered pricing suggestions and estimates for interior design projects',
      icon: Sparkles,
      status: 'coming-soon' as const,
      path: '/pricing-ai',
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border flex items-center justify-between px-6 sticky top-0 bg-background z-50">
        <div className="flex items-center gap-3">
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

      <main className="flex-1 p-6 md:p-8 lg:p-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">Welcome to KABS</h1>
            <p className="text-muted-foreground">
              Select a module to get started with your interior design workflow
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {modules.map((module) => (
              <Card
                key={module.id}
                className={`border-card-border bg-card cursor-pointer transition-all duration-200 hover-elevate ${
                  module.status === 'coming-soon' ? 'opacity-80' : ''
                }`}
                onClick={() => setLocation(module.path)}
                data-testid={`card-module-${module.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="p-2 bg-muted rounded-md">
                      <module.icon className="w-5 h-5 text-foreground" />
                    </div>
                    {module.status === 'active' ? (
                      <Badge variant="default" className="bg-green-600/20 text-green-400 border-green-600/30">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-blue-600/20 text-blue-400 border-blue-600/30">
                        Coming Soon
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-4">{module.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-muted-foreground">
                    {module.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <footer className="py-4 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">© KABS Annotation & Pricing AI</p>
      </footer>
    </div>
  );
}
