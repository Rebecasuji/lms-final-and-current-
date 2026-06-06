import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getStoredLeaves, updateLeaveStatus } from '@/lib/storage';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Check, X, FileText } from 'lucide-react';
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

export default function ViewLeaves() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaves = async () => {
      const allLeaves = await getStoredLeaves();
      let pending = allLeaves.filter(l => l.status === 'Pending');

      // Enrich missing employee names by querying users table in batch
      const missingIds = Array.from(new Set(
        pending
          .filter((l: any) => !l.employeeName)
          .flatMap((l: any) => [l.employeeId, l.employeeCode])
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

          pending = pending.map((l: any) => {
            const keyId = l.employeeId || l.employeeCode;
            const resolved = userMap[l.employeeId] || userMap[l.employeeCode] || (keyId && userMap[keyId]);
            return {
              ...l,
              employeeName: l.employeeName || (resolved ? (resolved.name || resolved.username) : ''),
            };
          });
        } catch (e) {
          console.error('Error enriching leave names in admin view:', e);
        }
      }
      setLeaves(pending);
      setLoading(false);
    };
    loadLeaves();
  }, []);

  const handleAction = async (id: string, status: 'Approved' | 'Rejected', reason?: string) => {
    console.log('ViewLeaves.handleAction', { id, status, reason, user });
    if (!user) {
      console.warn('No user in context; aborting action');
      return;
    }

    await updateLeaveStatus(id, status, `${user.code} (${user.name})`, reason);
    const allLeaves = await getStoredLeaves();
    setLeaves(allLeaves.filter(l => l.status === 'Pending'));

    toast({
      title: `Leave ${status}`,
      description: `Request has been ${status.toLowerCase()}.`,
      className: status === 'Approved'
        ? "bg-green-500/10 border-green-500/20 text-green-700 font-medium"
        : "bg-red-500/10 border-red-500/20 text-red-700 font-medium"
    });

    setRejectReason('');
    setSelectedLeaveId(null);
  };

  const filteredLeaves = leaves.filter(l =>
    l.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">View Pending Leaves</h2>
          <p className="text-slate-600">Review and take action on leave requests</p>
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

      {/* Note for OD/Comp Off dual approval */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-bold">⚠️ Note: OD and Comp Off leaves require approval from both HR and Admin before they are finalized.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredLeaves.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-100 italic">
            No pending leave requests found matching your search.
          </div>
        ) : (
          filteredLeaves.map((leave) => (
            <Card key={leave.id} className="bg-white border-slate-200 hover:border-primary/50 transition-all duration-300 shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      {/* Show name and id together when possible (e.g. "Naveen Kumar (E0053)") */}
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-slate-900">{leave.employeeName ? `${leave.employeeName} (${leave.employeeId || leave.employeeCode})` : (leave.employeeCode || leave.employeeId)}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-slate-50 border-slate-200 text-slate-700">{leave.type}</Badge>
                          <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 font-mono">{leave.employeeId || leave.employeeCode}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-500 font-medium">
                      <div><span className="text-slate-400">Duration:</span> {leave.startDate} to {leave.endDate} ({leave.duration})</div>
                      <div><span className="text-slate-400">Applied:</span> {leave.appliedDate}</div>
                      {leave.duration === 'Hourly' && leave.type === 'OD' && (
                        <div><span className="text-slate-400">OD Hours:</span> {leave.odFromTime} to {leave.odToTime}</div>
                      )}
                    </div>

                    <div className="mt-4 p-3 bg-slate-50 rounded-md border border-slate-100">
                      <p className="text-sm text-slate-600 italic">"{leave.description}"</p>
                    </div>

                    {leave.attachment && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <div role="button" className="flex items-center gap-2 text-xs text-primary mt-2 cursor-pointer hover:underline">
                            <FileText className="w-3 h-3" />
                            View Attachment
                          </div>
                        </DialogTrigger>
                        <DialogContent className="bg-white border-slate-200 w-[90vw] max-w-4xl">
                          <DialogHeader>
                            <DialogTitle className="text-slate-900">Attachment Preview</DialogTitle>
                            <DialogDescription className="text-sm text-slate-500">Preview the uploaded attachment</DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            {leave.attachment.startsWith('data:application/pdf') ? (
                              <iframe src={leave.attachment} className="w-full h-[70vh] border rounded" title="attachment-pdf" />
                            ) : (
                              <img src={leave.attachment} alt="attachment" className="mx-auto max-h-[70vh] object-contain" />
                            )}
                          </div>
                          <DialogFooter>
                            <a href={leave.attachment} download className="text-sm text-primary hover:underline">Download</a>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  <div className="flex items-center gap-3 md:flex-col md:justify-center min-w-[150px]">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          onClick={() => setSelectedLeaveId(leave.id)}
                          className="flex-1 w-full bg-green-50 aspect-video md:aspect-auto hover:bg-green-100 text-green-600 border border-green-200 font-bold"
                          data-testid={`button-approve-${leave.id}`}
                          title={['OD', 'Comp Off'].includes(leave.type) ? 'Requires approval from both HR and Admin' : ''}
                        >
                          <Check className="w-4 h-4 mr-2" /> Approve
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white border-slate-200">
                        <DialogHeader>
                          <DialogTitle className="text-slate-900">Approve Leave Request</DialogTitle>
                          <DialogDescription className="text-sm text-slate-500 font-medium">Are you sure you want to approve this leave request?</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-600">Cancel</Button>
                          <DialogClose asChild>
                            <Button onClick={() => handleAction(leave.id, 'Approved')} className="bg-green-600 hover:bg-green-700 text-white font-bold">Confirm Approval</Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="flex-1 w-full bg-red-50 hover:bg-red-100 text-red-600 border-red-200 font-bold"
                          data-testid={`button-reject-${leave.id}`}
                        >
                          <X className="w-4 h-4 mr-2" /> Reject
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white border-slate-200">
                        <DialogHeader>
                          <DialogTitle className="text-slate-900">Reject Leave Request</DialogTitle>
                          <DialogDescription className="text-slate-500 font-medium">
                            Please provide a reason for rejection. This will be visible to the employee.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <Label htmlFor="reason" className="text-slate-700 font-bold mb-2 block">Rejection Reason</Label>
                          <Textarea
                            id="reason"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="e.g. Critical project delivery deadline..."
                            className="bg-white border-slate-200 text-slate-900 mt-2"
                          />
                        </div>
                        <DialogFooter>
                          <Button variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-600">Cancel</Button>
                          <DialogClose asChild>
                            <Button
                              onClick={() => handleAction(leave.id, 'Rejected', rejectReason)}
                              disabled={!rejectReason}
                              className="bg-red-600 hover:bg-red-700 text-white font-bold"
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
