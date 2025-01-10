//time pipe transforms from seconds to minutes and secodns format

import { Pipe, PipeTransform } from "@angular/core";

@Pipe({name: 'timeFormat'})
export class TimePipe implements PipeTransform {
    transform(value: number): string {
        const minutes = Math.floor(value / 60);
        const seconds = value % 60;
    
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    }