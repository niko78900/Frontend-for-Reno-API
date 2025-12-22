import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  private themeTimeout?: number;

  get isDarkTheme(): boolean {
    return document.documentElement.dataset['theme'] === 'dark';
  }

  setTheme(theme: 'light' | 'dark'): void {
    const root = document.documentElement;
    if (root.dataset['theme'] === theme) {
      return;
    }
    root.classList.add('theme-transition');
    root.dataset['theme'] = theme;
    window.clearTimeout(this.themeTimeout);
    this.themeTimeout = window.setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 250);
  }
}
