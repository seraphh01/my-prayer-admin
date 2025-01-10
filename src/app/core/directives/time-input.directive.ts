import {
    Directive,
    ElementRef,
    HostListener,
    Renderer2,
    forwardRef,
  } from '@angular/core';
  import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
  
  @Directive({
    selector: '[timeInput]',
    providers: [
      {
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => TimeInputDirective),
        multi: true,
      },
    ],
  })
  export class TimeInputDirective implements ControlValueAccessor {
    private _value: number = 0;
  
    private onChange: (value: any) => void = () => {};
    private onTouched: () => void = () => {};
  
    constructor(private el: ElementRef, private renderer: Renderer2) {

          this.renderer.setAttribute(
            this.el.nativeElement,
            'placeholder',
            'mm:ss'
          );
    }
  
    // @HostListener('input', ['$event.target.value'])
    // onInput(value: string): void {
    //   // Validate and format the input value immediately for display purposes
    //   const formattedValue = this.formatValue(value);
    //   this.renderer.setProperty(this.el.nativeElement, 'value', formattedValue);
    // }
  
    @HostListener('blur', ['$event.target.value'])
    onBlur(value: string): void {
      // On blur, parse the input and update the model
      this._value = this.parseValue(value);
      this.onChange(this._value);
      this.onTouched();
  
      // Reformat the input field after updating the model
      const formattedValue = this.formatValue(value);
      this.renderer.setProperty(this.el.nativeElement, 'value', formattedValue);
    }
  
    writeValue(value: any): void {
      this._value = value || 0;
      const formattedValue = this.formatValueFromSeconds(this._value);
      this.renderer.setProperty(this.el.nativeElement, 'value', formattedValue);
    }
  
    registerOnChange(fn: any): void {
      this.onChange = fn;
    }
  
    registerOnTouched(fn: any): void {
      this.onTouched = fn;
    }
  
    private parseValue(value: string): number {
      const parts = value.split(':');
      const minutes = parseInt(parts[0] || '0', 10);
      const seconds = parseInt(parts[1] || '0', 10);
  
      return minutes * 60 + seconds;
    }
  
    private formatValue(value: string): string {
      const parts = value.split(':');
      let minutes = parseInt(parts[0] || '0', 10);
      let seconds = parseInt(parts[1] || '0', 10);
  
      // Adjust invalid seconds
      if (seconds >= 60) {
        minutes += Math.floor(seconds / 60);
        seconds = seconds % 60;
      }
  
      return `${this.pad(minutes)}:${this.pad(seconds)}`;
    }
  
    private formatValueFromSeconds(totalSeconds: number): string {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${this.pad(minutes)}:${this.pad(seconds)}`;
    }
  
    private pad(num: number): string {
      return num < 10 ? '0' + num : num.toString();
    }
  }
  