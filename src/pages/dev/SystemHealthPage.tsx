import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Database, Shield } from 'lucide-react';

interface TableCheck {
  module: string;
  tableName: string;
  exists: boolean | null;
  accessible: boolean | null;
  recordCount: number | null;
  error: string | null;
  loading: boolean;
}

const TABLES_TO_CHECK: { module: string; tableName: string }[] = [
  // CORE
  { module: 'CORE', tableName: 't_companies' },
  { module: 'CORE', tableName: 't_facilities' },
  { module: 'CORE', tableName: 't_employees' },
  { module: 'CORE', tableName: 't_app_users' },
  { module: 'CORE', tableName: 't_user_roles' },
  { module: 'CORE', tableName: 't_departments' },
  // PARTNERS
  { module: 'PARTNERS', tableName: 't_contractors' },
  // WMS
  { module: 'WMS', tableName: 't_products' },
  { module: 'WMS', tableName: 't_batches' },
  { module: 'WMS', tableName: 't_warehouse_movements' },
  { module: 'WMS', tableName: 't_warehouse_movement_items' },
  // MES
  { module: 'MES', tableName: 't_recipes' },
  { module: 'MES', tableName: 't_recipe_ingredients' },
  { module: 'MES', tableName: 't_production_orders' },
  { module: 'MES', tableName: 't_production_inputs' },
  { module: 'MES', tableName: 't_production_logs' },
  // LOGISTICS
  { module: 'LOGISTICS', tableName: 't_handling_units' },
  { module: 'LOGISTICS', tableName: 't_shipments' },
  { module: 'LOGISTICS', tableName: 't_shipment_items' },
  { module: 'LOGISTICS', tableName: 't_packaging_transactions' },
];

type ValidTableName = 
  | 't_companies' | 't_facilities' | 't_employees' | 't_app_users' | 't_user_roles' | 't_departments'
  | 't_contractors'
  | 't_products' | 't_batches' | 't_warehouse_movements' | 't_warehouse_movement_items'
  | 't_recipes' | 't_recipe_ingredients' | 't_production_orders' | 't_production_inputs' | 't_production_logs'
  | 't_handling_units' | 't_shipments' | 't_shipment_items' | 't_packaging_transactions';

export default function SystemHealthPage() {
  const [checks, setChecks] = useState<TableCheck[]>([]);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean; user: string | null }>({ 
    authenticated: false, 
    user: null 
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const checkTable = async (tableName: ValidTableName): Promise<Partial<TableCheck>> => {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === '42P01') {
          // Table does not exist
          addLog(`❌ ${tableName}: TABLE DOES NOT EXIST - ${error.message}`);
          return { exists: false, accessible: false, recordCount: null, error: error.message };
        }
        if (error.code === 'PGRST301' || error.message.includes('row-level security')) {
          // RLS blocking access
          addLog(`🔒 ${tableName}: RLS BLOCKED - ${error.message}`);
          return { exists: true, accessible: false, recordCount: null, error: `RLS: ${error.message}` };
        }
        addLog(`⚠️ ${tableName}: ERROR - ${error.code}: ${error.message}`);
        return { exists: null, accessible: false, recordCount: null, error: `${error.code}: ${error.message}` };
      }

      addLog(`✅ ${tableName}: OK (${count} records)`);
      return { exists: true, accessible: true, recordCount: count, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addLog(`💥 ${tableName}: EXCEPTION - ${message}`);
      return { exists: null, accessible: false, recordCount: null, error: message };
    }
  };

  const runHealthCheck = async () => {
    setIsRunning(true);
    setDebugLogs([]);
    addLog('🚀 Starting System Health Check...');
    
    // Check auth status
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setAuthStatus({ authenticated: true, user: session.user.email || session.user.id });
      addLog(`👤 Authenticated as: ${session.user.email || session.user.id}`);
    } else {
      setAuthStatus({ authenticated: false, user: null });
      addLog('⚠️ NOT AUTHENTICATED - RLS policies may block all access');
    }

    // Initialize all checks as loading
    const initialChecks: TableCheck[] = TABLES_TO_CHECK.map(t => ({
      ...t,
      exists: null,
      accessible: null,
      recordCount: null,
      error: null,
      loading: true,
    }));
    setChecks(initialChecks);

    // Run all checks
    const results = await Promise.all(
      TABLES_TO_CHECK.map(async (table) => {
        const result = await checkTable(table.tableName as ValidTableName);
        return { ...table, ...result, loading: false };
      })
    );

    setChecks(results as TableCheck[]);
    
    // Summary
    const existingTables = results.filter(r => r.exists === true).length;
    const accessibleTables = results.filter(r => r.accessible === true).length;
    const missingTables = results.filter(r => r.exists === false);
    const blockedTables = results.filter(r => r.exists === true && r.accessible === false);

    addLog('─────────────────────────────────');
    addLog(`📊 SUMMARY:`);
    addLog(`   Tables Existing: ${existingTables}/${TABLES_TO_CHECK.length}`);
    addLog(`   Tables Accessible: ${accessibleTables}/${TABLES_TO_CHECK.length}`);
    if (missingTables.length > 0) {
      addLog(`   ❌ Missing: ${missingTables.map(t => t.tableName).join(', ')}`);
    }
    if (blockedTables.length > 0) {
      addLog(`   🔒 RLS Blocked: ${blockedTables.map(t => t.tableName).join(', ')}`);
    }
    addLog('─────────────────────────────────');
    addLog('✅ Health Check Complete');
    
    setIsRunning(false);
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const getStatusBadge = (check: TableCheck) => {
    if (check.loading) {
      return <Badge variant="outline" className="animate-pulse">Checking...</Badge>;
    }
    if (check.exists === false) {
      return <Badge variant="destructive">Missing</Badge>;
    }
    if (check.exists === true && check.accessible === false) {
      return <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">RLS Blocked</Badge>;
    }
    if (check.accessible === true) {
      return <Badge variant="default" className="bg-green-500/20 text-green-600">OK</Badge>;
    }
    return <Badge variant="outline">Unknown</Badge>;
  };

  const getModuleColor = (module: string) => {
    switch (module) {
      case 'CORE': return 'text-blue-500';
      case 'PARTNERS': return 'text-purple-500';
      case 'WMS': return 'text-orange-500';
      case 'MES': return 'text-green-500';
      case 'LOGISTICS': return 'text-cyan-500';
      default: return 'text-muted-foreground';
    }
  };

  const stats = {
    total: checks.length,
    ok: checks.filter(c => c.accessible === true).length,
    blocked: checks.filter(c => c.exists === true && c.accessible === false).length,
    missing: checks.filter(c => c.exists === false).length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🏥 System Health Check</h1>
          <p className="text-muted-foreground">Database connectivity and RLS verification</p>
        </div>
        <Button onClick={runHealthCheck} disabled={isRunning}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Running...' : 'Re-run Check'}
        </Button>
      </div>

      {/* Auth Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            Authentication Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {authStatus.authenticated ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span>Authenticated as: <strong>{authStatus.user}</strong></span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Not authenticated - RLS policies will block most table access</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tables</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Accessible</p>
                <p className="text-2xl font-bold text-green-600">{stats.ok}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">RLS Blocked</p>
                <p className="text-2xl font-bold text-amber-600">{stats.blocked}</p>
              </div>
              <Shield className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missing</p>
                <p className="text-2xl font-bold text-red-600">{stats.missing}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Check Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Table Status Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Table Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead>Error Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checks.map((check) => (
                <TableRow key={check.tableName}>
                  <TableCell>
                    <Badge variant="outline" className={getModuleColor(check.module)}>
                      {check.module}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{check.tableName}</TableCell>
                  <TableCell>{getStatusBadge(check)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {check.recordCount !== null ? check.recordCount : '—'}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                    {check.error || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Debug Console */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔧 Debug Console
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 rounded-md border bg-muted/50 p-4">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {debugLogs.length > 0 ? debugLogs.join('\n') : 'No logs yet. Run health check to see output.'}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
