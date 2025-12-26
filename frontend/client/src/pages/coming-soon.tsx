import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Layers, Sparkles, ChevronDown, LogOut, ArrowLeft } from 'lucide-react';

export default function ComingSoonPage() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

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

      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="border-card-border bg-card max-w-lg w-full">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="inline-flex p-4 bg-blue-600/10 rounded-full mb-6">
              <Sparkles className="w-12 h-12 text-blue-400" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-3">Pricing AI</h1>
            <p className="text-lg text-blue-400 font-medium mb-4">Coming Soon</p>
            <p className="text-muted-foreground max-w-sm mx-auto">
              AI-powered pricing suggestions and estimates for your interior design projects. 
              Stay tuned for this exciting feature.
            </p>
            <Button
              variant="outline"
              className="mt-8"
              onClick={() => setLocation('/dashboard')}
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </main>

      <footer className="py-4 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">© KABS Annotation & Pricing AI</p>
      </footer>
    </div>
  );
}
