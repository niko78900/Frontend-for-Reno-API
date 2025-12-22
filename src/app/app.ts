import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  constructor() {
    this.enableDarkTheme();
  }

  enableDarkTheme(): void {
    document.documentElement.dataset['theme'] = 'dark';
  }
}
