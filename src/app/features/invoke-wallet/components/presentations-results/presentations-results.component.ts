import {CommonModule} from '@angular/common';
import {Component, inject, Input, OnInit} from '@angular/core';
import {MatListModule} from '@angular/material/list';
import {SharedModule} from "@shared/shared.module";
import {MatExpansionModule} from "@angular/material/expansion";
import {ConcludedTransaction} from "@core/models/ConcludedTransaction";
import {PresentationDefinition} from "@core/models/presentation/PresentationDefinition";
import {ViewAttestationComponent} from "@features/invoke-wallet/components/view-attestation/view-attestation.component";
import {SharedAttestation, Single} from "@core/models/presentation/SharedAttestation";
import {WalletResponseProcessorService} from "@features/invoke-wallet/services/wallet-response-processor.service";
import {MatCardModule} from "@angular/material/card";
import {MatButtonModule} from "@angular/material/button";
import {MatDialog, MatDialogModule} from "@angular/material/dialog";
import {RequestType} from '@app/core/constants/wallet-data';
import {LocalStorageService} from "@core/services/local-storage.service";
import {REGISTRATION_DATA} from "@core/constants/general";
import {VerifierEndpointService} from "@core/services/verifier-endpoint.service";

@Component({
  selector: 'vc-presentations-results',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    SharedModule,
    MatExpansionModule,
    MatCardModule,
    MatButtonModule,
    MatDialogModule,
    ViewAttestationComponent
  ],
  providers: [WalletResponseProcessorService, VerifierEndpointService],
  templateUrl: './presentations-results.component.html',
  styleUrls: ['./presentations-results.component.scss']
})
export class PresentationsResultsComponent implements OnInit {
  constructor(
    private readonly responseProcessor: WalletResponseProcessorService,
    private readonly localStorageService: LocalStorageService,
    private readonly verifierEndpointService: VerifierEndpointService,
  ) {
  }

  @Input() concludedTransaction!: ConcludedTransaction;
  @Input() requestType!: RequestType | null;
  presentationRequest!: PresentationDefinition;
  attestations!: Single[];
  missingAttributes: { [key: string]: string[] } = {};
  readonly dialog: MatDialog = inject(MatDialog);

  ngOnInit(): void {
    this.presentationRequest = this.concludedTransaction.presentationDefinition;
    let sharedAttestations: SharedAttestation[] = this.responseProcessor.mapVpTokenToAttestations(this.concludedTransaction);
    this.attestations = this.flatten(sharedAttestations);
    this.checkAttestation();
    this.localStorageService.remove(REGISTRATION_DATA);
  }

  flatten(sharedAttestations: SharedAttestation[]): Single[] {
    let singles: Single[] = []
    sharedAttestations.forEach(it => {
      switch (it.kind) {
        case "enveloped":
          return singles.push(...it.attestations)
        case "single":
          return singles.push(it)
      }
    })
    return singles
  }

  checkAttestation() {
    console.log("this.attestations", this.attestations)
    if (this.attestations) {
      let check = this.handleRequestType();
      let attri = this.attestations.reduce((acc: { [key: string]: string[] }, attr) => {
        const key = attr.name;
        console.log("key", key)
        console.log("acc[key]", acc[key])
        if (!acc[key]) {
          acc[key] = []
        }
        const attributes = attr.attributes.map((x) => x.key);
        console.log("attributes", attributes)

        acc[key] = attributes;
        console.log("acc", acc)
        return acc;
      }, {});

      console.log("attri", attri)
      Object.keys(attri).forEach((key) => {
        console.log("key", key)
        console.log("check[key]", check[key])
        check[key]?.forEach((x) => {
          console.log("x", x)
          console.log("attri[key]", attri[key])
          if (!attri[key].includes(x)) {
            if (!this.missingAttributes[key]) {
              this.missingAttributes[key] = [];
            }
            console.log("this.missingAttributes[key]", this.missingAttributes[key])
            this.missingAttributes[key].push(x);
          }
        })
      })
      // const expiry_date = this.attestations[0].attributes.find((x) => {
      //   x.key === 'org.iso.18013.5.1:expiry_date'
      // })

      // // if (expiry_date?.value <= Date.UTC)

      // this.attestations[0].attributes.forEach((x) => {

      //   if (x.key === 'org.iso.18013.5.1:family_name') {

      //   }

      // })
      console.log(this.missingAttributes);
      this.verifierEndpointService.updateRegistrationDataStatus(
        this.concludedTransaction.transactionId,
        JSON.stringify({
          walletResponse: this.concludedTransaction.walletResponse,
          missingAttributes: JSON.stringify(this.missingAttributes),
        }))
        .subscribe(value => {
          console.log("Final registration data", value)
        })
    }
  }

  viewContents(attestation: Single) {
    this.dialog.open(ViewAttestationComponent, {
      data: {
        attestation: attestation
      },
      height: '40%',
      width: '60%',
    });
  }

  handleRequestType(): { [key: string]: string[] } {
    switch (this.requestType) {
      case 'PID':
        return {
          'eu.europa.ec.eudi.pid.1':
            [
              'eu.europa.ec.eudi.pid.1:family_name_birth',
              'eu.europa.ec.eudi.pid.1:given_name_birth',
              'eu.europa.ec.eudi.pid.1:expiry_date'
            ]
        };

      case 'PIDMDL':
        return {
          'eu.europa.ec.eudi.pid.1': [
            'eu.europa.ec.eudi.pid.1:family_name_birth',
            'eu.europa.ec.eudi.pid.1:given_name_birth',
            'eu.europa.ec.eudi.pid.1:expiry_date',
          ],
          'org.iso.18013.5.1.mDL': [
            'org.iso.18013.5.1:family_name',
            'org.iso.18013.5.1:given_name',
            'org.iso.18013.5.1:birth_date',
            'org.iso.18013.5.1:expiry_date'
          ]
        };

      case 'MDL':
        return {
          'org.iso.18013.5.1.mDL': [
            'org.iso.18013.5.1:family_name',
            'org.iso.18013.5.1:given_name',
            'org.iso.18013.5.1:birth_date',
            'org.iso.18013.5.1:expiry_date'
          ]
        };

      case 'PartialMDL':
        return {
          'org.iso.18013.5.1.mDL': [
            'org.iso.18013.5.1:family_name',
            'org.iso.18013.5.1:given_name',
            'org.iso.18013.5.1:expiry_date'
          ]
        };

      case 'PartialMDLUnderage':
        return {
          'org.iso.18013.5.1.mDL': [
            'org.iso.18013.5.1:family_name',
            'org.iso.18013.5.1:given_name',
            'org.iso.18013.5.1:expiry_date',
            'org.iso.18013.5.1:age_over_18'
          ]
        };

      default: return {};
    }
  }
}
