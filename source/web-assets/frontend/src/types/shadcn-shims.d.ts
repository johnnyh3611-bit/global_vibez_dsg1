/**
 * Broad type shims for shadcn/ui JSX vendor files.
 *
 * The shadcn primitives at `@/components/ui/*` are auto-generated from
 * Radix and ship as untyped `.jsx`. Rather than hand-type every one
 * (Radix's `forwardRef` wrapper signatures are heavy and fragile across
 * upgrades), this file declares every consumer-facing export as a
 * permissive `React.FC<any>`.
 *
 * The tradeoff: callers don't get prop-level autocomplete inside these
 * shadcn components, but they DO get it everywhere else in the codebase.
 * If a specific component's props matter for type safety (e.g. Button,
 * Card, Alert, Input), promote that component from .jsx to .tsx with
 * real types — those take precedence over this ambient shim.
 */
declare module '@/components/ui/accordion' {
  export const Accordion: React.FC<any>;
  export const AccordionItem: React.FC<any>;
  export const AccordionTrigger: React.FC<any>;
  export const AccordionContent: React.FC<any>;
}
declare module '@/components/ui/alert-dialog' {
  export const AlertDialog: React.FC<any>;
  export const AlertDialogTrigger: React.FC<any>;
  export const AlertDialogContent: React.FC<any>;
  export const AlertDialogHeader: React.FC<any>;
  export const AlertDialogFooter: React.FC<any>;
  export const AlertDialogTitle: React.FC<any>;
  export const AlertDialogDescription: React.FC<any>;
  export const AlertDialogAction: React.FC<any>;
  export const AlertDialogCancel: React.FC<any>;
}
declare module '@/components/ui/aspect-ratio' {
  export const AspectRatio: React.FC<any>;
}
declare module '@/components/ui/avatar' {
  export const Avatar: React.FC<any>;
  export const AvatarImage: React.FC<any>;
  export const AvatarFallback: React.FC<any>;
}
declare module '@/components/ui/badge' {
  export const Badge: React.FC<any>;
  export const badgeVariants: any;
}
declare module '@/components/ui/breadcrumb' {
  export const Breadcrumb: React.FC<any>;
  export const BreadcrumbList: React.FC<any>;
  export const BreadcrumbItem: React.FC<any>;
  export const BreadcrumbLink: React.FC<any>;
  export const BreadcrumbPage: React.FC<any>;
  export const BreadcrumbSeparator: React.FC<any>;
  export const BreadcrumbEllipsis: React.FC<any>;
}
declare module '@/components/ui/calendar' {
  export const Calendar: React.FC<any>;
}
declare module '@/components/ui/carousel' {
  export const Carousel: React.FC<any>;
  export const CarouselContent: React.FC<any>;
  export const CarouselItem: React.FC<any>;
  export const CarouselPrevious: React.FC<any>;
  export const CarouselNext: React.FC<any>;
  export const CarouselApi: any;
}
declare module '@/components/ui/chart' {
  export const ChartContainer: React.FC<any>;
  export const ChartTooltip: React.FC<any>;
  export const ChartTooltipContent: React.FC<any>;
  export const ChartLegend: React.FC<any>;
  export const ChartLegendContent: React.FC<any>;
  export const ChartStyle: React.FC<any>;
}
declare module '@/components/ui/checkbox' {
  export const Checkbox: React.FC<any>;
}
declare module '@/components/ui/collapsible' {
  export const Collapsible: React.FC<any>;
  export const CollapsibleTrigger: React.FC<any>;
  export const CollapsibleContent: React.FC<any>;
}
declare module '@/components/ui/command' {
  export const Command: React.FC<any>;
  export const CommandDialog: React.FC<any>;
  export const CommandInput: React.FC<any>;
  export const CommandList: React.FC<any>;
  export const CommandEmpty: React.FC<any>;
  export const CommandGroup: React.FC<any>;
  export const CommandItem: React.FC<any>;
  export const CommandSeparator: React.FC<any>;
  export const CommandShortcut: React.FC<any>;
}
declare module '@/components/ui/context-menu' {
  export const ContextMenu: React.FC<any>;
  export const ContextMenuTrigger: React.FC<any>;
  export const ContextMenuContent: React.FC<any>;
  export const ContextMenuItem: React.FC<any>;
  export const ContextMenuCheckboxItem: React.FC<any>;
  export const ContextMenuRadioItem: React.FC<any>;
  export const ContextMenuLabel: React.FC<any>;
  export const ContextMenuSeparator: React.FC<any>;
  export const ContextMenuShortcut: React.FC<any>;
  export const ContextMenuGroup: React.FC<any>;
  export const ContextMenuPortal: React.FC<any>;
  export const ContextMenuSub: React.FC<any>;
  export const ContextMenuSubContent: React.FC<any>;
  export const ContextMenuSubTrigger: React.FC<any>;
  export const ContextMenuRadioGroup: React.FC<any>;
}
declare module '@/components/ui/dialog' {
  export const Dialog: React.FC<any>;
  export const DialogPortal: React.FC<any>;
  export const DialogOverlay: React.FC<any>;
  export const DialogTrigger: React.FC<any>;
  export const DialogClose: React.FC<any>;
  export const DialogContent: React.FC<any>;
  export const DialogHeader: React.FC<any>;
  export const DialogFooter: React.FC<any>;
  export const DialogTitle: React.FC<any>;
  export const DialogDescription: React.FC<any>;
}
declare module '@/components/ui/drawer' {
  export const Drawer: React.FC<any>;
  export const DrawerPortal: React.FC<any>;
  export const DrawerOverlay: React.FC<any>;
  export const DrawerTrigger: React.FC<any>;
  export const DrawerClose: React.FC<any>;
  export const DrawerContent: React.FC<any>;
  export const DrawerHeader: React.FC<any>;
  export const DrawerFooter: React.FC<any>;
  export const DrawerTitle: React.FC<any>;
  export const DrawerDescription: React.FC<any>;
}
declare module '@/components/ui/dropdown-menu' {
  export const DropdownMenu: React.FC<any>;
  export const DropdownMenuTrigger: React.FC<any>;
  export const DropdownMenuContent: React.FC<any>;
  export const DropdownMenuItem: React.FC<any>;
  export const DropdownMenuCheckboxItem: React.FC<any>;
  export const DropdownMenuRadioItem: React.FC<any>;
  export const DropdownMenuLabel: React.FC<any>;
  export const DropdownMenuSeparator: React.FC<any>;
  export const DropdownMenuShortcut: React.FC<any>;
  export const DropdownMenuGroup: React.FC<any>;
  export const DropdownMenuPortal: React.FC<any>;
  export const DropdownMenuSub: React.FC<any>;
  export const DropdownMenuSubContent: React.FC<any>;
  export const DropdownMenuSubTrigger: React.FC<any>;
  export const DropdownMenuRadioGroup: React.FC<any>;
}
declare module '@/components/ui/form' {
  export const Form: React.FC<any>;
  export const FormField: React.FC<any>;
  export const FormItem: React.FC<any>;
  export const FormLabel: React.FC<any>;
  export const FormControl: React.FC<any>;
  export const FormDescription: React.FC<any>;
  export const FormMessage: React.FC<any>;
  export const useFormField: any;
}
declare module '@/components/ui/hover-card' {
  export const HoverCard: React.FC<any>;
  export const HoverCardTrigger: React.FC<any>;
  export const HoverCardContent: React.FC<any>;
}
declare module '@/components/ui/input-otp' {
  export const InputOTP: React.FC<any>;
  export const InputOTPGroup: React.FC<any>;
  export const InputOTPSlot: React.FC<any>;
  export const InputOTPSeparator: React.FC<any>;
}
declare module '@/components/ui/label' {
  export const Label: React.FC<any>;
}
declare module '@/components/ui/menubar' {
  export const Menubar: React.FC<any>;
  export const MenubarMenu: React.FC<any>;
  export const MenubarTrigger: React.FC<any>;
  export const MenubarContent: React.FC<any>;
  export const MenubarItem: React.FC<any>;
  export const MenubarSeparator: React.FC<any>;
  export const MenubarLabel: React.FC<any>;
  export const MenubarCheckboxItem: React.FC<any>;
  export const MenubarRadioGroup: React.FC<any>;
  export const MenubarRadioItem: React.FC<any>;
  export const MenubarPortal: React.FC<any>;
  export const MenubarSubContent: React.FC<any>;
  export const MenubarSubTrigger: React.FC<any>;
  export const MenubarGroup: React.FC<any>;
  export const MenubarSub: React.FC<any>;
  export const MenubarShortcut: React.FC<any>;
}
declare module '@/components/ui/navigation-menu' {
  export const NavigationMenu: React.FC<any>;
  export const NavigationMenuList: React.FC<any>;
  export const NavigationMenuItem: React.FC<any>;
  export const NavigationMenuContent: React.FC<any>;
  export const NavigationMenuTrigger: React.FC<any>;
  export const NavigationMenuLink: React.FC<any>;
  export const NavigationMenuIndicator: React.FC<any>;
  export const NavigationMenuViewport: React.FC<any>;
  export const navigationMenuTriggerStyle: any;
}
declare module '@/components/ui/pagination' {
  export const Pagination: React.FC<any>;
  export const PaginationContent: React.FC<any>;
  export const PaginationItem: React.FC<any>;
  export const PaginationLink: React.FC<any>;
  export const PaginationPrevious: React.FC<any>;
  export const PaginationNext: React.FC<any>;
  export const PaginationEllipsis: React.FC<any>;
}
declare module '@/components/ui/popover' {
  export const Popover: React.FC<any>;
  export const PopoverTrigger: React.FC<any>;
  export const PopoverContent: React.FC<any>;
}
declare module '@/components/ui/progress' {
  export const Progress: React.FC<any>;
}
declare module '@/components/ui/radio-group' {
  export const RadioGroup: React.FC<any>;
  export const RadioGroupItem: React.FC<any>;
}
declare module '@/components/ui/resizable' {
  export const ResizablePanelGroup: React.FC<any>;
  export const ResizablePanel: React.FC<any>;
  export const ResizableHandle: React.FC<any>;
}
declare module '@/components/ui/scroll-area' {
  export const ScrollArea: React.FC<any>;
  export const ScrollBar: React.FC<any>;
}
declare module '@/components/ui/select' {
  export const Select: React.FC<any>;
  export const SelectGroup: React.FC<any>;
  export const SelectValue: React.FC<any>;
  export const SelectTrigger: React.FC<any>;
  export const SelectContent: React.FC<any>;
  export const SelectLabel: React.FC<any>;
  export const SelectItem: React.FC<any>;
  export const SelectSeparator: React.FC<any>;
  export const SelectScrollUpButton: React.FC<any>;
  export const SelectScrollDownButton: React.FC<any>;
}
declare module '@/components/ui/separator' {
  export const Separator: React.FC<any>;
}
declare module '@/components/ui/sheet' {
  export const Sheet: React.FC<any>;
  export const SheetPortal: React.FC<any>;
  export const SheetOverlay: React.FC<any>;
  export const SheetTrigger: React.FC<any>;
  export const SheetClose: React.FC<any>;
  export const SheetContent: React.FC<any>;
  export const SheetHeader: React.FC<any>;
  export const SheetFooter: React.FC<any>;
  export const SheetTitle: React.FC<any>;
  export const SheetDescription: React.FC<any>;
}
declare module '@/components/ui/sidebar' {
  export const Sidebar: React.FC<any>;
  export const SidebarProvider: React.FC<any>;
  export const SidebarContent: React.FC<any>;
  export const SidebarFooter: React.FC<any>;
  export const SidebarGroup: React.FC<any>;
  export const SidebarGroupAction: React.FC<any>;
  export const SidebarGroupContent: React.FC<any>;
  export const SidebarGroupLabel: React.FC<any>;
  export const SidebarHeader: React.FC<any>;
  export const SidebarInput: React.FC<any>;
  export const SidebarInset: React.FC<any>;
  export const SidebarMenu: React.FC<any>;
  export const SidebarMenuAction: React.FC<any>;
  export const SidebarMenuBadge: React.FC<any>;
  export const SidebarMenuButton: React.FC<any>;
  export const SidebarMenuItem: React.FC<any>;
  export const SidebarMenuSkeleton: React.FC<any>;
  export const SidebarMenuSub: React.FC<any>;
  export const SidebarMenuSubButton: React.FC<any>;
  export const SidebarMenuSubItem: React.FC<any>;
  export const SidebarRail: React.FC<any>;
  export const SidebarSeparator: React.FC<any>;
  export const SidebarTrigger: React.FC<any>;
  export const useSidebar: any;
}
declare module '@/components/ui/skeleton' {
  export const Skeleton: React.FC<any>;
}
declare module '@/components/ui/slider' {
  export const Slider: React.FC<any>;
}
declare module '@/components/ui/sonner' {
  export const Toaster: React.FC<any>;
  export const toast: any;
}
declare module '@/components/ui/switch' {
  export const Switch: React.FC<any>;
}
declare module '@/components/ui/table' {
  export const Table: React.FC<any>;
  export const TableHeader: React.FC<any>;
  export const TableBody: React.FC<any>;
  export const TableFooter: React.FC<any>;
  export const TableHead: React.FC<any>;
  export const TableRow: React.FC<any>;
  export const TableCell: React.FC<any>;
  export const TableCaption: React.FC<any>;
}
declare module '@/components/ui/tabs' {
  export const Tabs: React.FC<any>;
  export const TabsList: React.FC<any>;
  export const TabsTrigger: React.FC<any>;
  export const TabsContent: React.FC<any>;
}
declare module '@/components/ui/textarea' {
  export const Textarea: React.FC<any>;
}
declare module '@/components/ui/toast' {
  export const Toast: React.FC<any>;
  export const ToastProvider: React.FC<any>;
  export const ToastViewport: React.FC<any>;
  export const ToastTitle: React.FC<any>;
  export const ToastDescription: React.FC<any>;
  export const ToastClose: React.FC<any>;
  export const ToastAction: React.FC<any>;
}
declare module '@/components/ui/toaster' {
  export const Toaster: React.FC<any>;
}
declare module '@/components/ui/toggle' {
  export const Toggle: React.FC<any>;
  export const toggleVariants: any;
}
declare module '@/components/ui/toggle-group' {
  export const ToggleGroup: React.FC<any>;
  export const ToggleGroupItem: React.FC<any>;
}
declare module '@/components/ui/tooltip' {
  export const Tooltip: React.FC<any>;
  export const TooltipTrigger: React.FC<any>;
  export const TooltipContent: React.FC<any>;
  export const TooltipProvider: React.FC<any>;
}
declare module '@/components/ui/use-toast' {
  export const useToast: any;
  export const toast: any;
  export const reducer: any;
}
