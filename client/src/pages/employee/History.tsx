import { useAuth } from '@/context/AuthContext';
import { getStoredLeaves } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEffect, useState } from 'react';

export default function LeaveHistory() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) return;
      const all = await getStoredLeaves();
      if (!mounted) return;
      // Match by employeeCode (username) OR employeeId (user_id) to handle different DB states
      const matched = all.filter((l: any) => (
        l.employeeCode === user.code ||
        l.employeeId === user.id ||
        l.employeeCode === user.id ||
        l.employeeId === user.code
      ));
      // sort newest first
      matched.sort((a: any, b: any) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());
      setLeaves(matched);
    };
    load();
    return () => { mounted = false; };
  }, [user]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Rejected': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-6">
        <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">Leave History</h2>
        <p className="text-slate-600">Track all your past and current leave applications</p>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="text-slate-600 font-bold">Type</TableHead>
                <TableHead className="text-slate-600 font-bold">Dates</TableHead>
                <TableHead className="text-slate-600 font-bold">Duration</TableHead>
                <TableHead className="text-slate-600 font-bold">Reason</TableHead>
                <TableHead className="text-slate-600 font-bold">Applied On</TableHead>
                <TableHead className="text-slate-600 font-bold">Attachment</TableHead>
                <TableHead className="text-slate-600 font-bold">Status</TableHead>
                <TableHead className="text-slate-600 font-bold">Action By</TableHead>
                <TableHead className="text-slate-600 font-bold">Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500 italic">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                leaves.map((leave) => (
                  <TableRow key={leave.id} className="hover:bg-slate-50 border-slate-100 transition-colors">
                    <TableCell className="font-semibold text-slate-900">{leave.type}</TableCell>
                    <TableCell className="text-slate-600 font-medium">
                      {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">
                      {leave.duration}
                      {leave.duration === 'Hourly' && leave.type === 'OD' && (
                        <div className="text-xs text-slate-500 font-normal">{leave.odFromTime} - {leave.odToTime}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 max-w-[200px] truncate" title={leave.description}>
                      {leave.description}
                    </TableCell>
                    <TableCell className="text-slate-600 font-medium">{format(new Date(leave.appliedDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="text-slate-600">
                      {leave.attachment ? (
                        <a href={leave.attachment} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          View
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(leave.status)}>
                        {leave.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 font-medium">
                      {leave.actionBy ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">{leave.actionBy}</span>
                          <span className="text-[10px]">{leave.actionDate ? format(new Date(leave.actionDate), 'MMM dd, yyyy') : ''}</span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 max-w-[220px] truncate italic" title={leave.reasonForAction || ''}>
                      {leave.reasonForAction || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
