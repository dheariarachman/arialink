import {Slot} from '@radix-ui/react-slot';
import {cva} from 'class-variance-authority';
import {cn} from '../../lib/utils.js';

const buttonVariants=cva('inline-flex items-center justify-center');

function Button({className,asChild=false,...props}){
 const Comp=asChild?Slot:'button';
 return <Comp data-slot="button" className={cn(buttonVariants(),className)} {...props}/>;
}

export {Button,buttonVariants};
