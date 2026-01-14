import { Component, HostListener } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService, AuthSession } from './services/auth.service';
import { AppMessage, AppMessageService } from './services/app-message.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private selectInEditMode: HTMLSelectElement | null = null;
  readonly session$: Observable<AuthSession | null>;
  readonly message$: Observable<AppMessage | null>;

  constructor(
    private location: Location,
    private authService: AuthService,
    private messageService: AppMessageService
  ) {
    this.session$ = this.authService.session$;
    this.message$ = this.messageService.message$;
    this.enableDarkTheme();
  }

  enableDarkTheme(): void {
    document.documentElement.dataset['theme'] = 'dark';
  }

  @HostListener('document:keydown', ['$event'])
  handleGlobalKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (this.selectInEditMode && document.activeElement !== this.selectInEditMode) {
      this.selectInEditMode = null;
    }

    const selectTarget = event.target instanceof HTMLSelectElement ? event.target : null;
    if (selectTarget) {
      const isEditing = this.selectInEditMode === selectTarget;

      if (!isEditing && (event.key === 'Enter' || event.key === ' ')) {
        this.selectInEditMode = selectTarget;
        return;
      }

      if (isEditing && (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape')) {
        this.selectInEditMode = null;
        return;
      }

      if (this.isArrowKey(event.key) && !isEditing) {
        this.moveFocus(event.key === 'ArrowRight' || event.key === 'ArrowDown');
        event.preventDefault();
        return;
      }

      if (isEditing) {
        return;
      }
    }

    if (this.isEditableTarget(event.target)) {
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.location.back();
      return;
    }

    if (this.isArrowKey(event.key)) {
      this.moveFocus(event.key === 'ArrowRight' || event.key === 'ArrowDown');
      event.preventDefault();
      return;
    }

    if (event.key === 'Enter') {
      this.activateFocusedElement(event);
    }
  }

  private isArrowKey(key: string): boolean {
    return key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) {
      return false;
    }

    const tagName = target.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
      return true;
    }

    return target.isContentEditable;
  }

  private moveFocus(forward: boolean): void {
    const focusableElements = this.getFocusableElements();
    if (!focusableElements.length) {
      return;
    }

    const active = document.activeElement as HTMLElement | null;
    let index = active ? focusableElements.indexOf(active) : -1;
    if (index === -1) {
      index = forward ? -1 : 0;
    }

    let nextIndex = index + (forward ? 1 : -1);
    if (nextIndex >= focusableElements.length) {
      nextIndex = 0;
    }
    if (nextIndex < 0) {
      nextIndex = focusableElements.length - 1;
    }

    focusableElements[nextIndex].focus();
  }

  private getFocusableElements(): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((element) => {
      if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
        return false;
      }
      if (element.tabIndex < 0) {
        return false;
      }
      if (!element.isConnected) {
        return false;
      }
      if (element.closest('[aria-hidden="true"]')) {
        return false;
      }
      const style = window.getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') {
        return false;
      }
      return element.getClientRects().length > 0;
    });
  }

  private activateFocusedElement(event: KeyboardEvent): void {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || active === document.documentElement) {
      return;
    }

    const isDisabled = (active as HTMLButtonElement).disabled || active.getAttribute('aria-disabled') === 'true';
    if (isDisabled) {
      return;
    }

    const tagName = active.tagName;
    const isActionable = tagName === 'BUTTON' || tagName === 'A' || active.getAttribute('role') === 'button';
    if (!isActionable) {
      return;
    }

    event.preventDefault();
    active.click();
  }

  logout(): void {
    this.authService.logout();
  }

  clearMessage(): void {
    this.messageService.clear();
  }
}
