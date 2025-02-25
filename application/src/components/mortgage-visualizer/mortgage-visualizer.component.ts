import { CommonModule } from '@angular/common';
import { Component, SimpleChanges, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSliderModule  } from '@angular/material/slider';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
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
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSliderModule,
    MatRadioModule,
  ],
  templateUrl: './mortgage-visualizer.component.html',
  styleUrl: './mortgage-visualizer.component.scss'
})
export class MortgageVisualizerComponent {
  public paymentDates: string[] = [];
  public remainingPrincipleDataset: any = {};
  public paymentDetails: PaymentDetail[] = [];
  public totalInterest: number = 0;

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

  public startDateFormControl: FormControl<Date> = new FormControl(new Date(), { nonNullable: true })

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

  chartData: ChartData<'line'> = { labels: [], datasets: [] };
    chartOptions: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      elements: {
        point: {
          radius: 0,
          hoverRadius: 10,
          hitRadius: 1000,
        }
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 5
          }
        },
      },
      plugins: {
        tooltip: {
          displayColors: false,
          callbacks: {
              label: (labelData: any) => {
                const principlePaid = `Payment principle: ${this.formatToCurrency(this.paymentDetails[labelData.dataIndex].principalPaid)}`;
                const interestPaid = `Payment interest: ${this.formatToCurrency(this.paymentDetails[labelData.dataIndex].interestPaid)}`;
                return [principlePaid, interestPaid];
              }
          }
        }
      }
    };
  
  constructor() {
    Chart.register(...registerables);

    this.intialPurchasePriceInputSubject.pipe(debounceTime(2000)).subscribe(value => {
      this._purchasePriceNgModel = value;
      this.purchasePriceFormControl.setValue(value)
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
        
        this.paymentDetails = calculateMortgage(mortgageParams);
        this.paymentDates = [];
        const remainingPrinciples: number[] = [];
        this.totalInterest = 0;
        
        this.paymentDetails.forEach(payment => {
          this.paymentDates.push(payment.paymentDate);
          remainingPrinciples.push(payment.remainingPrincipal);
          this.totalInterest += payment.interestPaid;
        });
        
        this.remainingPrincipleDataset = {
          label: 'Remaining principle',
          data: remainingPrinciples,
          backgroundColor: '#a5d8ff',
          borderColor: '#4dabf7',
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
    this.chartData = {
      labels: this.paymentDates,
      datasets: [this.remainingPrincipleDataset]
    };

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
