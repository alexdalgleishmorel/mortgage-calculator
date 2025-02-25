import { Component } from '@angular/core';

import { MortgageVisualizerComponent } from '@components/mortgage-visualizer/mortgage-visualizer.component';

@Component({
  selector: 'app-root',
  imports: [MortgageVisualizerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'application';
}
