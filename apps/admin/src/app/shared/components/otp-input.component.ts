import { Component, ElementRef, QueryList, ViewChildren, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-otp-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center gap-2 md:gap-4 justify-center" (paste)="onPaste($event)">
      @for (box of boxes; track $index) {
        <input
          #inputBox
          type="text"
          maxLength="1"
          class="w-12 h-14 text-center text-xl font-bold rounded-lg border bg-white/10 dark:bg-black/20 border-gray-300 dark:border-white/10 text-gray-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
          [attr.aria-label]="'OTP digit ' + ($index + 1)"
          (keydown)="onKeyDown($event, $index)"
          (input)="onInput($event, $index)"
        />
      }
    </div>
  `
})
export class OtpInputComponent {
  length = input<number>(6);
  otpChange = output<string>();

  @ViewChildren('inputBox') inputBoxes!: QueryList<ElementRef<HTMLInputElement>>;

  get boxes(): number[] {
    return Array(this.length()).fill(0);
  }

  onInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    if (value) {
      this.focusNext(index);
    }
    this.emitValue();
  }

  onKeyDown(event: KeyboardEvent, index: number) {
    const input = event.target as HTMLInputElement;
    
    if (event.key === 'Backspace' && !input.value) {
      this.focusPrevious(index);
      this.emitValue();
    } else if (event.key === 'ArrowLeft') {
      this.focusPrevious(index);
    } else if (event.key === 'ArrowRight') {
      this.focusNext(index);
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const data = event.clipboardData?.getData('text') || '';
    const cleanData = data.replace(/[^0-9]/g, '').slice(0, this.length());
    
    const elements = this.inputBoxes.toArray();
    for (let i = 0; i < cleanData.length; i++) {
      if (elements[i]) {
        elements[i].nativeElement.value = cleanData[i];
      }
    }
    
    const nextFocusIndex = Math.min(cleanData.length, this.length() - 1);
    elements[nextFocusIndex]?.nativeElement.focus();
    this.emitValue();
  }

  private focusNext(index: number) {
    const elements = this.inputBoxes.toArray();
    if (elements[index + 1]) {
      elements[index + 1].nativeElement.focus();
    }
  }

  private focusPrevious(index: number) {
    const elements = this.inputBoxes.toArray();
    if (elements[index - 1]) {
      elements[index - 1].nativeElement.focus();
    }
  }

  private emitValue() {
    const code = this.inputBoxes
      .toArray()
      .map(ref => ref.nativeElement.value)
      .join('');
    this.otpChange.emit(code);
  }
}
