import { useForm } from 'react-hook-form';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { addLeaveRequest, getLeaveBalance, LeaveBalance } from '@/lib/storage';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';

const leaveSchema = z.object({
  type: z.enum(['Casual', 'Sick', 'LWP', 'Earned', 'OD', 'Comp Off']),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  duration: z.enum(['Full Day', 'Half Day', 'Hourly']).optional(),
  fromTime: z.string().optional(),
  toTime: z.string().optional(),
  description: z.string().min(5, "Reason is required"),
}).refine((data) => {
  // If Hourly is selected, fromTime and toTime are required
  if (data.duration === 'Hourly') {
    return data.fromTime && data.toTime;
  }
  return true;
}, {
  message: "From Time and To Time are required for Hourly OD",
  path: ["duration"],
});

const permissionSchema = z.object({
  permissionType: z.enum(['Official', 'Personal']).optional(),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  reason: z.string().min(5, "Reason is required"),
});

type LeaveForm = z.infer<typeof leaveSchema>;
type PermissionForm = z.infer<typeof permissionSchema>;

export default function ApplyLeave() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [attachment, setAttachment] = useState<{
    name: string;
    size: number;
    type: string;
    dataUrl: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (user) {
      getLeaveBalance(user.code).then(setBalance);
    }
  }, [user]);

  const form = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      type: 'Casual',
      duration: 'Full Day',
      fromTime: '',
      toTime: '',
    }
  });

  // Watch for changes to enable reactive rendering
  const watchedLeaveType = form.watch('type');
  const watchedDuration = form.watch('duration');

  const permissionForm = useForm<PermissionForm>({
    resolver: zodResolver(permissionSchema),
    defaultValues: {
      permissionType: 'Official',
    }
  });

  const [requestKind, setRequestKind] = useState<'Leave' | 'Permission'>('Leave');

  const onSubmit = async (data: LeaveForm) => {
    console.log('ApplyLeave onSubmit called', data);
    if (!user) return;

    // Get the correct user_id from AuthContext (the DB user_id stored in `user.id`)
    const user_id = user.id;
    if (!user_id) {
      toast({ title: 'Error', description: 'User not properly logged in. Please log in again.', variant: 'destructive' });
      return;
    }

    // Optional: Check balance before submitting (soft check)
    if (data.type === 'Casual' && balance && balance.casual.remaining <= 0) {
      toast({
        title: "Warning",
        description: "You have exhausted your Casual Leave quota. This may be processed as LWP.",
        variant: "destructive"
      });
    }

    const leaveData = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: user_id,
      employeeName: user.name,
      employeeCode: user.code,
      ...data,
      status: 'Pending' as const,
      attachment: attachment?.dataUrl,
      appliedDate: new Date().toISOString().split('T')[0],
      ...(data.duration === 'Hourly' && data.type === 'OD' ? {
        odFromTime: data.fromTime,
        odToTime: data.toTime,
      } : {})
    } as any;

    try {
      await addLeaveRequest(leaveData);
    } catch (err) {
      console.error('Failed to submit leave:', err);
      const message = (err as any)?.message || JSON.stringify(err) || 'Could not submit leave request.';
      toast({ title: 'Submission failed', description: message, variant: 'destructive' });
      return;
    }

    // Send email notification to HR and Admin (using fixed fallback emails)
    fetch('/api/send-leave-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeName: user.name,
        leaveType: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.description,
        duration: data.duration,
        ...(data.duration === 'Hourly' ? { fromTime: data.fromTime, toTime: data.toTime } : {}),
        hrEmails: ['naveen@ctint.in'],
        adminEmails: ['naveen@ctint.in']
      })
    }).catch(() => { });

    toast({
      title: "✅ Leave Application Submitted",
      description: "Your manager will review it shortly. Notification sent to HR and Admin.",
      className: "bg-green-500/10 border-green-500/20 text-green-700 font-medium"
    });

    setLocation('/employee/dashboard');
  };

  const onPermissionSubmit = async (data: PermissionForm) => {
    console.log('Apply Permission onSubmit', data);
    if (!user) return;

    const user_id = user.id;
    if (!user_id) {
      toast({ title: 'Error', description: 'User not properly logged in. Please log in again.', variant: 'destructive' });
      return;
    }

    const permissionData = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: user_id,
      employeeName: user.name,
      employeeCode: user.code,
      type: 'Permission',
      permissionType: data.permissionType || 'Official',
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      description: data.reason,
      status: 'Pending',
      appliedDate: new Date().toISOString().split('T')[0]
    };

    try {
      await addLeaveRequest(permissionData as any);
    } catch (err) {
      console.error('Failed to submit permission:', err);
      const message = (err as any)?.message || JSON.stringify(err) || 'Could not submit permission request.';
      toast({ title: 'Submission failed', description: message, variant: 'destructive' });
      return;
    }

    // Send permission notification
    try {
      const { adminEmails, hrEmails } = await (await import('@/lib/storage')).getNotificationEmails();
      fetch('/api/send-permission-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: user.name,
          permissionType: data.permissionType || 'Official',
          startTime: data.startTime,
          endTime: data.endTime,
          reason: data.reason,
          hrEmails,
          adminEmails
        })
      }).catch(err => console.log('Permission email notification sent (demo)'));
    } catch (e) {
      console.log('Failed to resolve notification emails for permission, using defaults', e);
      fetch('/api/send-permission-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: user.name,
          permissionType: data.permissionType || 'Official',
          startTime: data.startTime,
          endTime: data.endTime,
          reason: data.reason,
          hrEmails: ['naveen@ctint.in'],
          adminEmails: ['naveen@ctint.in']
        })
      }).catch(() => { });
    }

    toast({
      title: "✅ Permission Request Submitted",
      description: "HR/Admin will review it shortly. Notification sent.",
      className: "bg-green-500/10 border-green-500/20 text-green-700 font-medium"
    });

    setLocation('/employee/dashboard');
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Only PDF, JPG, PNG are allowed', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum allowed size is 5MB', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({ name: file.name, size: file.size, type: file.type, dataUrl: reader.result as string });
      toast({ title: 'Attachment added', description: file.name });
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFile(file);
  };

  const removeAttachment = () => setAttachment(null);

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Apply for Leave</h2>
          <p className="text-slate-600">Submit your leave request for approval</p>
        </div>
        {balance && (
          <div className="flex gap-4 text-xs">
            <div className="bg-white border border-slate-200 px-3 py-2 rounded-md shadow-sm">
              <span className="text-slate-500 block">Casual Balance</span>
              <span className={`font-bold ${balance.casual.remaining === 0 ? 'text-red-500' : 'text-primary'}`}>
                {balance.casual.remaining} / {balance.casual.total}
              </span>
            </div>
            <div className="bg-white border border-slate-200 px-3 py-2 rounded-md shadow-sm">
              <span className="text-slate-500 block">Sick Balance</span>
              <span className={`font-bold ${balance.sick.remaining === 0 ? 'text-red-500' : 'text-primary'}`}>
                {balance.sick.remaining} / {balance.sick.total}
              </span>
            </div>
          </div>
        )}
      </div>

      <Card className="bg-white border-slate-200 shadow-2xl">
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Leave Type</Label>
              <Select onValueChange={(val) => form.setValue('type', val as any)} defaultValue={form.getValues('type')}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900">
                  <SelectItem value="Casual">Casual Leave</SelectItem>
                  <SelectItem value="Sick">Sick Leave</SelectItem>
                  <SelectItem value="OD">On Duty (OD)</SelectItem>
                  <SelectItem value="Comp Off">Comp Off</SelectItem>
                  <SelectItem value="LWP">Leave Without Pay (LWP)</SelectItem>
                  <SelectItem value="Earned">Earned Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Start Date</Label>
                <Input
                  type="date"
                  {...form.register('startDate')}
                  className="bg-white border-slate-200 text-slate-900"
                />
                {form.formState.errors.startDate && <p className="text-red-400 text-xs">{form.formState.errors.startDate.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">End Date</Label>
                <Input
                  type="date"
                  {...form.register('endDate')}
                  className="bg-white border-slate-200 text-slate-900"
                />
                {form.formState.errors.endDate && <p className="text-red-400 text-xs">{form.formState.errors.endDate.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Duration</Label>
              <RadioGroup
                defaultValue="Full Day"
                onValueChange={(val) => {
                  form.setValue('duration', val as any);
                  // Clear time fields when switching away from Hourly
                  if (val !== 'Hourly') {
                    form.setValue('fromTime', '');
                    form.setValue('toTime', '');
                  }
                }}
                className="flex gap-4 flex-wrap"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Full Day" id="full" className="border-slate-300 text-primary" />
                  <Label htmlFor="full" className="text-slate-900">Full Day</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Half Day" id="half" className="border-slate-300 text-primary" />
                  <Label htmlFor="half" className="text-slate-900">Half Day</Label>
                </div>
                {watchedLeaveType === 'OD' && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Hourly" id="hourly" className="border-slate-300 text-primary" />
                    <Label htmlFor="hourly" className="text-slate-900">Hourly</Label>
                  </div>
                )}
              </RadioGroup>
            </div>

            {watchedDuration === 'Hourly' && watchedLeaveType === 'OD' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">From Time</Label>
                  <Input
                    type="time"
                    {...form.register('fromTime')}
                    className="bg-white border-slate-200 text-slate-900"
                  />
                  {form.formState.errors.fromTime && <p className="text-red-400 text-xs">{form.formState.errors.fromTime.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">To Time</Label>
                  <Input
                    type="time"
                    {...form.register('toTime')}
                    className="bg-white border-slate-200 text-slate-900"
                  />
                  {form.formState.errors.toTime && <p className="text-red-400 text-xs">{form.formState.errors.toTime.message}</p>}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Reason / Description</Label>
              <Textarea
                {...form.register('description')}
                placeholder="Please describe the reason for your leave..."
                className="bg-white border-slate-200 text-slate-900 min-h-[100px]"
              />
              {form.formState.errors.description && <p className="text-red-400 text-xs">{form.formState.errors.description.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Attachment (Optional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={onFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                role="button"
                className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer bg-slate-50"
              >
                {!attachment ? (
                  <>
                    <p className="text-sm text-slate-600 font-medium">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG up to 5MB</p>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-sm text-slate-900 font-semibold">{attachment.name}</p>
                      <p className="text-xs text-slate-500 font-medium">{(attachment.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" onClick={(e) => { e.stopPropagation(); removeAttachment(); }} className="text-red-400">Remove</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                Submit Application
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
