import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getStoredPermissions, updatePermissionStatus, PermissionRequest } from '@/lib/storage';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Check, X, Lock, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ViewPermissions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [selectedPermissionId, setSelectedPermissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      const allPermissions = await getStoredPermissions();
      let pending = allPermissions.filter(p => p.status === 'Pending');

      // Enrich missing employee names by querying users table in batch (both user_id and username)
      const missingIds = Array.from(new Set(
        pending
          .filter((p: any) => !p.employeeName)
          .flatMap((p: any) => [p.employeeId, p.employeeCode])
          .filter(Boolean)
      ));

      if (missingIds.length > 0) {
        try {
          const { data: usersById } = await supabase.from('users').select('user_id,name,username').in('user_id', missingIds as any[]);
          const { data: usersByUsername } = await supabase.from('users').select('user_id,name,username').in('username', missingIds as any[]);
          const users = [...(usersById || []), ...(usersByUsername || [])];

          const userMap: Record<string, any> = {};
          users.forEach((u: any) => {
            if (u.user_id) userMap[u.user_id] = u;
            if (u.username) userMap[u.username] = u;
          });

          pending = pending.map((p: any) => {
            const keyId = p.employeeId || p.employeeCode;
            const resolved = userMap[p.employeeId] || userMap[p.employeeCode] || (keyId && userMap[keyId]);
            return {
              ...p,
              employeeName: p.employeeName || (resolved ? (resolved.name || resolved.username) : ''),
            };
          });
        } catch (e) {
          console.error('Error enriching permission names in admin view:', e);
        }
      }
      setPermissions(pending);
      setLoading(false);
    };
    loadPermissions();
  }, []);

  const handleAction = async (id: string, status: 'Approved' | 'Rejected', reason?: string) => {
    console.log('ViewPermissions.handleAction', { id, status, reason, user });
    if (!user) {
      console.warn('No user in context; aborting action');
      return;
    }

    await updatePermissionStatus(id, status, `${user.code} (${user.name})`, reason);
    const allPermissions = await getStoredPermissions();
    setPermissions(allPermissions.filter(p => p.status === 'Pending'));

    toast({
      title: `Permission ${status}`,
      description: `Request has been ${status.toLowerCase()}.`,
      className: status === 'Approved'
        ? "bg-green-500/10 border-green-500/20 text-green-700 font-medium"
        : "bg-red-500/10 border-red-500/20 text-red-700 font-medium"
    });

    setRejectReason('');
    setSelectedPermissionId(null);
  };

  const filteredPermissions = permissions.filter(p =>
    p.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPermissionTypeColor = (type: string) => {
    switch (type) {
      case 'Late Entry Permission':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'Early Exit Permission':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'Personal Work Permission':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Emergency Permission':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">View Pending Permissions</h2>
          <p className="text-slate-600">Review and take action on permission requests</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by Name, Code, Type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white border-slate-200 text-slate-900 focus:border-primary/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredPermissions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
            <Lock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            No pending permission requests found.
          </div>
        ) : (
          filteredPermissions.map((permission) => (
            <Card key={permission.id} className="bg-white border-slate-200 hover:border-primary/50 transition-all duration-300 shadow-sm">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-slate-900">{permission.employeeName ? `${permission.employeeName} (${permission.employeeId || permission.employeeCode})` : (permission.employeeCode || permission.employeeId)}</p>
                        <div className="flex items-center gap-2">
                          <Badge className={`${getPermissionTypeColor(permission.type)} border`}>{permission.type}</Badge>
                          {permission.isLOPApplicable && (
                            <Badge className="bg-yellow-500/20 text-yellow-700 border border-yellow-500/30 font-semibold">
                              LOP Applicable
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-primary border-primary/20">{permission.employeeId || permission.employeeCode}</Badge>
                        </div>
                      </div>
                    </div>
                    {/* type and id shown above; keep layout consistent */}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 px-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Perm Date</p>
                      <p className="text-sm font-semibold text-slate-900">{permission.date}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Start Time</p>
                      <p className="text-sm font-semibold text-slate-900">{permission.startTime}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">End Time</p>
                      <p className="text-sm font-semibold text-slate-900">{permission.endTime}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Duration</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {permission.durationMinutes ? `${Math.floor(permission.durationMinutes / 60)}h ${permission.durationMinutes % 60}m` : '-'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">Reason:</p>
                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-100">{permission.reason}</p>
                  </div>

                  {permission.additionalInfo && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-1">Additional Info:</p>
                      <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-100">{permission.additionalInfo}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          onClick={() => setSelectedPermissionId(permission.id)}
                          className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white border-slate-200">
                        <DialogHeader>
                          <DialogTitle className="text-slate-900">Approve Permission Request</DialogTitle>
                          <DialogDescription className="text-slate-600">
                            Employee: <span className="text-primary font-semibold">{permission.employeeName}</span>
                          </DialogDescription>
                        </DialogHeader>
                        <p className="text-sm text-slate-600">Are you sure you want to approve this permission request?</p>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            className="text-slate-600 border-slate-200 hover:bg-slate-50"
                          >
                            Cancel
                          </Button>
                          <DialogClose asChild>
                            <Button
                              onClick={() => handleAction(permission.id, 'Approved')}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Confirm Approval
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          onClick={() => setSelectedPermissionId(permission.id)}
                          className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white border-slate-200">
                        <DialogHeader>
                          <DialogTitle className="text-slate-900">Reject Permission Request</DialogTitle>
                          <DialogDescription className="text-slate-600">
                            Employee: <span className="text-primary font-semibold">{permission.employeeName}</span>
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label className="text-slate-700 font-medium">Reason for Rejection (Optional)</Label>
                            <Textarea
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Provide a reason for rejection..."
                              className="mt-2 bg-white border-slate-200 text-slate-900 min-h-[100px]"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            className="text-slate-600 border-slate-200 hover:bg-slate-50"
                          >
                            Cancel
                          </Button>
                          <DialogClose asChild>
                            <Button
                              onClick={() => handleAction(permission.id, 'Rejected', rejectReason)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Confirm Rejection
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
