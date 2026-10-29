'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {cn} from '../../lib/utils.js';

function Dialog({children,...props}){return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>;}
function DialogContent({className,children,...props}){
 return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="ui-dialog-overlay"/><DialogPrimitive.Content className={cn('ui-dialog-content',className)} {...props}>{children}<DialogPrimitive.Close className="ui-dialog-close" aria-label="Tutup"><X className="icon" strokeWidth={1.75} aria-hidden="true"/></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>;
}
const DialogTitle=DialogPrimitive.Title;
const DialogDescription=DialogPrimitive.Description;
export {Dialog,DialogContent,DialogTitle,DialogDescription};
