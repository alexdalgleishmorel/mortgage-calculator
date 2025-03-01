import { CommonModule } from '@angular/common';
import { Component, SimpleChanges, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSliderModule  } from '@angular/material/slider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { ChartData, ChartOptions, Chart, registerables } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { CurrencyMaskModule } from "ng2-currency-mask";
import { debounceTime, Subject } from 'rxjs';

import { MortgageParams, PaymentDetail, PaymentFrequency, calculateMortgage } from './calculator';

@Component({
  selector: 'app-mortgage-visualizer',
  imports: [
    CommonModule,
    CurrencyMaskModule,
    ReactiveFormsModule,
    BaseChartDirective,
    FormsModule,
    MatDatepickerModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
    MatRadioModule,
    MatTabsModule,
  ],
  templateUrl: './mortgage-visualizer.component.html',
  styleUrl: './mortgage-visualizer.component.scss'
})
export class MortgageVisualizerComponent {
  public paymentDates: string[] = [];
  public paymentDetails: PaymentDetail[] = [];
  public totalInterest: number = 0;
  public finalPaymentDate: string = '';

  private _initialPurchasePriceNgModel = 0;
  get initialPurchasePriceNgModel(): number {
    return this._initialPurchasePriceNgModel;
  }
  set initialPurchasePriceNgModel(val: number) {
    this._initialPurchasePriceNgModel = val;
    this.intialPurchasePriceInputSubject.next(val);
  }

  private _purchasePriceNgModel = 0;
  get purchasePriceNgModel(): number {
    return this._purchasePriceNgModel;
  }
  set purchasePriceNgModel(val: number) {
    this._purchasePriceNgModel = val;
    this.purchasePriceFormControl.setValue(val);
  }

  public startDateFormControl: FormControl<Date> = new FormControl(new Date(), { nonNullable: true });

  public interestFormControl: FormControl<number> = new FormControl(5, { nonNullable: true });
  public lumpSumFormControl: FormControl<number> = new FormControl(0, { nonNullable: true });
  public downPaymentFormControl: FormControl<number> = new FormControl(0, { nonNullable: true });

  public purchasePriceFormControl: FormControl<number> = new FormControl(0, { nonNullable: true });
  public paymentFrequencyFormControl: FormControl<PaymentFrequency> = new FormControl('monthly', { nonNullable: true });
  public termYearsFormControl: FormControl<number> = new FormControl(25, { nonNullable: true });

  private intialPurchasePriceInputSubject = new Subject<number>();
  private allControls: FormGroup = new FormGroup({
    interest: this.interestFormControl,
    lumpSum: this.lumpSumFormControl,
    downPayment: this.downPaymentFormControl,
    purchasePrice: this.purchasePriceFormControl,
    paymentFrequency: this.paymentFrequencyFormControl,
    termYears: this.termYearsFormControl,
    startDate: this.startDateFormControl,
  });

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  // Hybrid chartData: contains two bar datasets (for cumulative interest and principal) and one line dataset (remaining principal)
  chartData: ChartData<'bar' | 'line'> = { labels: [], datasets: [] };

  // Chart options: using a single, stacked y‑axis.
  chartOptions: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    elements: {
      point: {
        radius: 0,
        hoverRadius: 10,
        hitRadius: 10,
      }
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          maxTicksLimit: 3
        }
      },
      y: {
        stacked: true,
      }
    },
    plugins: {
      tooltip: {
        displayColors: true,
        callbacks: {
          label: (tooltipItem: any) => {
            if (tooltipItem.datasetIndex === 0) {
              return `Cumulative Interest: ${this.formatToCurrency(tooltipItem.raw)}`;
            } else if (tooltipItem.datasetIndex === 1) {
              return `Cumulative Principal: ${this.formatToCurrency(tooltipItem.raw)}`;
            } else if (tooltipItem.datasetIndex === 2) {
              const details = this.paymentDetails[tooltipItem.dataIndex];
              const principalPaid = `Payment Principal: ${this.formatToCurrency(details.principalPaid || 0)}`;
              const interestPaid = `Payment Interest: ${this.formatToCurrency(details.interestPaid || 0)}`;
              return [principalPaid, interestPaid];
            }
            return tooltipItem.formattedValue;
          }
        }
      }
    }
  };
  
  constructor() {
    Chart.register(...registerables);

    this.intialPurchasePriceInputSubject.pipe(debounceTime(2000)).subscribe(value => {
      this._purchasePriceNgModel = value;
      this.purchasePriceFormControl.setValue(value);
    });

    this.allControls.valueChanges.pipe(debounceTime(100)).subscribe(() => {
      if (this.purchasePriceFormControl.value) {
        const mortgageParams: MortgageParams = {
          totalPrice: this.purchasePriceFormControl.value,
          downPayment: this.downPaymentFormControl.value,
          interestRate: this.interestFormControl.value,
          termYears: this.termYearsFormControl.value,
          frequency: this.paymentFrequencyFormControl.value,
          lumpSumPayment: this.lumpSumFormControl.value,
          startDate: this.startDateFormControl.value.toISOString(),
        };

        if (this.paymentDetails.length) {
          this.paymentDetails = calculateMortgage(mortgageParams, this.paymentDetails);
        } else {
          this.paymentDetails = calculateMortgage(mortgageParams);
        }

        const initPaymentDates = !this.paymentDates.length;
        const remainingPrinciples: any[] = [];
        const interestData: number[] = [];
        const principalData: number[] = [];
        this.totalInterest = 0;

        let finalPaymentDateFound = false;
        this.paymentDetails.forEach(payment => {
          if (initPaymentDates) {
            this.paymentDates.push(payment.paymentDate);
          }
          remainingPrinciples.push(payment.remainingPrincipal);
          interestData.push(payment.interestPaid || 0);
          principalData.push(payment.principalPaid || 0);
          this.totalInterest += payment.interestPaid || 0;

          if (!finalPaymentDateFound && payment.remainingPrincipal === 0) {
            this.finalPaymentDate = payment.paymentDate;
            finalPaymentDateFound = true;
          }
        });
        
        const cumulativeInterest: (number | null)[] = [];
        const cumulativePrincipal: (number | null)[] = [];
        let sumInterest = 0, sumPrincipal = 0;
        let completed = false;
        for (let i = 0; i < interestData.length; i++) {
          if (!completed) {
            sumInterest += interestData[i];
            sumPrincipal += principalData[i];
            cumulativeInterest.push(sumInterest);
            cumulativePrincipal.push(sumPrincipal);
            if (remainingPrinciples[i] === 0) {
              completed = true;
            }
          } else {
            cumulativeInterest.push(null);
            cumulativePrincipal.push(null);
          }
        }
        
        // Create the datasets:
        // Bar datasets for cumulative interest and cumulative principal (stacked together in "stack1").
        const interestDataset = {
          type: 'bar' as const,
          label: 'Cumulative Interest Paid',
          data: cumulativeInterest,
          backgroundColor: '#ffc9c9',
          borderColor: '#ff8787',
          stack: 'stack1',
          order: 2
        };
        const principalDataset = {
          type: 'bar' as const,
          label: 'Cumulative Principal Paid',
          data: cumulativePrincipal,
          backgroundColor: '#b2f2bb',
          borderColor: '#69db7c',
          stack: 'stack1',
          order: 2
        };
        // Line dataset for remaining principal.
        const remainingPrincipleDataset = {
          type: 'line' as const,
          label: 'Remaining Principal',
          data: remainingPrinciples,
          backgroundColor: '#a5d8ff',
          borderColor: '#4dabf7',
          fill: false,
          stack: 'line',
          order: 1
        };

        this.chartData = {
          labels: this.paymentDates,
          datasets: [interestDataset, principalDataset, remainingPrincipleDataset]
        };

        this.updateChart();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datasets'] || changes['labels']) {
      this.updateChart();
    }
  }
  
  updateChart(): void {
    if (this.chart) {
      this.chart.update();
    }
  }

  formatToCurrency(value: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }
}
