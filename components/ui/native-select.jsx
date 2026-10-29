import {cn} from '../../lib/utils.js';

function NativeSelect({className,...props}){
 return <select data-slot="native-select" className={cn(className)} {...props}/>;
}
export {NativeSelect};
