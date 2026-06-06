import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, AlertTriangle } from 'lucide-react';
import { addPermissionRequest, PermissionRequest, getMonthlyPermissionCount, calculateDurationMinutes } from '@/lib/storage';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const permissionSchema = z.object({
  type: z.enum(['Late Entry Permission', 'Early Exit Permission', 'Personal Work Permission', 'Emergency Permission']),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  additionalInfo: z.string().optional(),
}).refine((data) => {
  // Validate that end time is after start time
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const startTotalMin = startHour * 60 + startMin;
  const endTotalMin = endHour * 60 + endMin;
  return endTotalMin > startTotalMin;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
}).refine((data) => {
  // Validate that duration doesn't exceed 2 hours (120 minutes)
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const startTotalMin = startHour * 60 + startMin;
  const endTotalMin = endHour * 60 + endMin;
  const durationMinutes = endTotalMin - startTotalMin;
  return durationMinutes <= 120;
}, {
  message: "Permission duration cannot exceed 2 hours (120 minutes)",
  path: ["endTime"],
});

type PermissionForm = z.infer<typeof permissionSchema>;

export default function Permission({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showLOPWarning, setShowLOPWarning] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PermissionForm>({
    resolver: zodResolver(permissionSchema),
    defaultValues: {
      type: 'Late Entry Permission',
      date: new Date().toISOString().split('T')[0],
    }
  });

  const handleSubmitWithLOPCheck = async (data: PermissionForm) => {
    console.log('Permission onSubmit called', data);
    if (!user) return;

    // Get the correct user_id from AuthContext (the DB user_id stored in `user.id`)
    const user_id = user.id;
    if (!user_id) {
      toast({ title: 'Error', description: 'User not properly logged in. Please log in again.', variant: 'destructive' });
      return;
    }

    // Check monthly permission count
    const count = await getMonthlyPermissionCount(user_id, data.date);
    setMonthlyCount(count);

    const permissionRequest: PermissionRequest = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: user_id,
      employeeName: user.name,
      employeeCode: user.code,
      type: data.type,
      startTime: data.startTime,
      endTime: data.endTime,
      date: data.date,
      reason: data.reason,
      additionalInfo: data.additionalInfo,
      status: 'Pending',
      appliedDate: new Date().toISOString().split('T')[0],
      durationMinutes: calculateDurationMinutes(data.startTime, data.endTime),
      isLOPApplicable: count >= 3, // If already at 3 or more, mark as LOP
    };

    // If monthly limit exceeded (>= 3 requests already), show LOP warning
    if (count >= 3) {
      setPendingPermission(permissionRequest);
      setShowLOPWarning(true);
      return;
    }

    // Otherwise, directly submit
    await submitPermissionRequest(permissionRequest);
  };

  const submitPermissionRequest = async (permissionRequest: PermissionRequest) => {
    try {
      setIsSubmitting(true);
      await addPermissionRequest(permissionRequest);

      // Send email notification to HR and Admin
      fetch('/api/send-permission-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: user?.name,
          permissionType: permissionRequest.type,
          date: permissionRequest.date,
          startTime: permissionRequest.startTime,
          endTime: permissionRequest.endTime,
          reason: permissionRequest.reason,
          isLOPApplicable: permissionRequest.isLOPApplicable,
          hrEmails: ['naveen@ctint.in'],
          adminEmails: ['naveen@ctint.in']
        })
      }).catch(() => { });

      console.log('Permission Request Submitted:', permissionRequest);

      const message = permissionRequest.isLOPApplicable
        ? "⚠️ Permission request submitted and marked as Loss of Pay (LOP)."
        : "Your request has been sent to HR and Admin for approval. Notification sent to their email.";

      toast({
        title: "✅ Permission Request Submitted",
        description: message,
        className: permissionRequest.isLOPApplicable
          ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-700 font-medium"
          : "bg-green-500/10 border-green-500/20 text-green-700 font-medium"
      });

      form.reset();
      setShowLOPWarning(false);
      setPendingPermission(null);

      if (onClose) {
        onClose();
      } else {
        setLocation('/employee/dashboard');
      }
    } catch (err) {
      console.error('Failed to submit permission:', err);
      const message = (err as any)?.message || JSON.stringify(err) || 'Could not submit permission request.';
      toast({ title: 'Submission failed', description: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLOPContinue = async () => {
    if (pendingPermission) {
      await submitPermissionRequest(pendingPermission);
    }
  };

  return (
    <>
      {!onClose ? (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Lock className="w-6 h-6 text-primary" />
              <h2 className="text-3xl font-display font-bold text-slate-900">Request Permission</h2>
            </div>
            <p className="text-slate-600">Submit a request for permission you need</p>
          </div>
          <Card className="bg-white border-slate-200 shadow-2xl">
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(handleSubmitWithLOPCheck)} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Permission Type</Label>
                  <Select onValueChange={(val) => form.setValue('type', val as any)} defaultValue={form.getValues('type')}>
                    <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900">
                      <SelectItem value="Late Entry Permission">Late Entry Permission</SelectItem>
                      <SelectItem value="Early Exit Permission">Early Exit Permission</SelectItem>
                      <SelectItem value="Personal Work Permission">Personal Work Permission</SelectItem>
                      <SelectItem value="Emergency Permission">Emergency Permission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Permission Date</Label>
                  <Input
                    type="date"
                    {...form.register('date')}
                    className="bg-white border-slate-200 text-slate-900"
                  />
                  {form.formState.errors.date && <p className="text-red-400 text-xs">{form.formState.errors.date.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Start Time</Label>
                    <Input
                      type="time"
                      {...form.register('startTime')}
                      className="bg-white border-slate-200 text-slate-900"
                    />
                    {form.formState.errors.startTime && <p className="text-red-400 text-xs">{form.formState.errors.startTime.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">End Time</Label>
                    <Input
                      type="time"
                      {...form.register('endTime')}
                      className="bg-white border-slate-200 text-slate-900"
                    />
                    {form.formState.errors.endTime && <p className="text-red-400 text-xs">{form.formState.errors.endTime.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Reason / Justification</Label>
                  <Textarea
                    {...form.register('reason')}
                    placeholder="Please explain why you need this permission..."
                    className="bg-white border-slate-200 text-slate-900 min-h-[100px]"
                  />
                  {form.formState.errors.reason && <p className="text-red-400 text-xs">{form.formState.errors.reason.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Additional Information (Optional)</Label>
                  <Textarea
                    {...form.register('additionalInfo')}
                    placeholder="Add any additional details or context..."
                    className="bg-white border-slate-200 text-slate-900 min-h-[80px]"
                  />
                </div>

                <div className="pt-4">
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                    Submit Permission Request
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Permission Type</Label>
            <Select onValueChange={(val) => form.setValue('type', val as any)} defaultValue={form.getValues('type')}>
              <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900">
                <SelectItem value="Late Entry Permission">Late Entry Permission</SelectItem>
                <SelectItem value="Early Exit Permission">Early Exit Permission</SelectItem>
                <SelectItem value="Personal Work Permission">Personal Work Permission</SelectItem>
                <SelectItem value="Emergency Permission">Emergency Permission</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Permission Date</Label>
            <Input
              type="date"
              {...form.register('date')}
              className="bg-white border-slate-200 text-slate-900"
            />
            {form.formState.errors.date && <p className="text-red-400 text-xs">{form.formState.errors.date.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Start Time</Label>
              <Input
                type="time"
                {...form.register('startTime')}
                className="bg-white border-slate-200 text-slate-900"
              />
              {form.formState.errors.startTime && <p className="text-red-400 text-xs">{form.formState.errors.startTime.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">End Time</Label>
              <Input
                type="time"
                {...form.register('endTime')}
                className="bg-white border-slate-200 text-slate-900"
              />
              {form.formState.errors.endTime && <p className="text-red-400 text-xs">{form.formState.errors.endTime.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Reason / Justification</Label>
            <Textarea
              {...form.register('reason')}
              placeholder="Please explain why you need this permission..."
              className="bg-white border-slate-200 text-slate-900 min-h-[100px]"
            />
            {form.formState.errors.reason && <p className="text-red-400 text-xs">{form.formState.errors.reason.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium">Additional Information (Optional)</Label>
            <Textarea
              {...form.register('additionalInfo')}
              placeholder="Add any additional details or context..."
              className="bg-white border-slate-200 text-slate-900 min-h-[80px]"
            />
          </div>

          <div className="pt-4">
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              Submit Permission Request
            </Button>
          </div>
        </form>
      )}

      {/* LOP Warning Modal */}
      <Dialog open={showLOPWarning} onOpenChange={setShowLOPWarning}>
        <DialogContent className="bg-white border-slate-200">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <DialogTitle className="text-yellow-900">Monthly Permission Limit Exceeded</DialogTitle>
            </div>
            <DialogDescription className="text-slate-600 mt-2">
              You have already utilized your maximum monthly permission limit of 3 requests. 
              Any additional permission request will be considered as <span className="font-semibold text-yellow-700">Loss of Pay (LOP)</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 my-4">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">This month's permission count:</span> {monthlyCount}
              <br />
              <span className="font-semibold">This request will be marked as:</span> <span className="text-yellow-700 font-bold">LOP Applicable</span>
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowLOPWarning(false);
                setPendingPermission(null);
              }}
              className="border-slate-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleLOPContinue}
              disabled={isSubmitting}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {isSubmitting ? "Submitting..." : "Continue & Submit as LOP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

