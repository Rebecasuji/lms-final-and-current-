import { useState, useEffect } from 'react';
import { getStoredLeaves } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Search, Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

export default function ApprovedLeaves() {
    const [leaves, setLeaves] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const loadLeaves = async () => {
            const allLeaves = await getStoredLeaves();
            const approved = allLeaves.filter(l => l.status === 'Approved');
            setLeaves(approved);
            setLoading(false);
        };
        loadLeaves();
    }, []);

    const exportToExcel = () => {
        try {
            const exportData = filteredLeaves.map(l => ({
                'Employee Name': l.employeeName,
                'Employee Code': l.employeeCode,
                'Leave Type': l.type,
                'Duration': l.duration,
                'Start Date': l.startDate,
                'End Date': l.endDate,
                'Applied Date': l.appliedDate,
                'Approved By': l.actionBy || '-',
                'Reason': l.description
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Approved Leaves');
            XLSX.writeFile(wb, `Approved-Leaves-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

            toast({
                title: "Success",
                description: "Export completed successfully!",
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to export data",
                variant: "destructive"
            });
        }
    };

    const filteredLeaves = leaves.filter(l => {
        const matchesSearch = searchTerm === '' ||
            l.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.type.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDate = !selectedDate || (l.startDate <= selectedDate && l.endDate >= selectedDate);
        return matchesSearch && matchesDate;
    });

    const getStatusColor = (type: string) => {
        switch (type) {
            case 'Casual': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'Sick': return 'bg-red-500/10 text-red-600 border-red-500/20';
            case 'OD': return 'bg-green-500/10 text-green-600 border-green-500/20';
            case 'Comp Off': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
            default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-display font-bold text-slate-900 mb-2">Approved Leaves</h2>
                    <p className="text-slate-600">History of all finalized leave requests</p>
                </div>
                <Button
                    onClick={exportToExcel}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg"
                >
                    <Download className="w-4 h-4 mr-2" /> Export Excel
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search by Employee, Code, or Type..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-white border-slate-200"
                    />
                </div>
                <div className="relative w-full md:w-64">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="pl-10 bg-white border-slate-200"
                    />
                </div>
            </div>

            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="font-bold">Employee</TableHead>
                                    <TableHead className="font-bold">Type</TableHead>
                                    <TableHead className="font-bold">Duration</TableHead>
                                    <TableHead className="font-bold">Period</TableHead>
                                    <TableHead className="font-bold">Reason</TableHead>
                                    <TableHead className="font-bold">Approved By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-slate-500 italic">
                                            Loading leaves...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLeaves.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-slate-500 italic">
                                            No approved leaves found matching your filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLeaves.map((leave) => (
                                        <TableRow key={leave.id} className="hover:bg-slate-50 border-slate-100">
                                            <TableCell>
                                                <div className="font-medium text-slate-900">{leave.employeeName}</div>
                                                <div className="text-xs text-primary font-mono font-bold">{leave.employeeCode}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={getStatusColor(leave.type)}>
                                                    {leave.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-slate-600 font-medium">
                                                {leave.duration}
                                                {leave.duration === 'Hourly' && leave.type === 'OD' && (
                                                    <div className="text-xs text-slate-500 font-normal">{leave.odFromTime} - {leave.odToTime}</div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-slate-600 text-sm">
                                                {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}
                                            </TableCell>
                                            <TableCell className="text-slate-600 max-w-[200px] truncate" title={leave.description}>
                                                {leave.description}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-xs font-medium text-slate-700">{leave.actionBy || '-'}</div>
                                                <div className="text-[10px] text-slate-400">{leave.appliedDate} (Applied)</div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
