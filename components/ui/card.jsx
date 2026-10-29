import {cn} from '../../lib/utils.js';

function Card({className,as:Comp='div',...props}){
 return <Comp data-slot="card" className={cn(className)} {...props}/>;
}

export {Card};
