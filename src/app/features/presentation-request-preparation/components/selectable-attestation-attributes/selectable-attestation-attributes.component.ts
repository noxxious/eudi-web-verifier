import {Component, inject, OnInit} from '@angular/core';
import {FieldConstraint, Filter} from "@core/models/presentation/FieldConstraint";
import {FormSelectableField} from "@core/models/FormSelectableField";
import {InputDescriptor} from "@core/models/presentation/InputDescriptor";
import {AttestationFormat} from "@core/models/attestation/AttestationFormat";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatExpansionModule} from "@angular/material/expansion";
import {SharedModule} from "@shared/shared.module";
import {AttestationType} from "@core/models/attestation/AttestationType";
import {getAttestationByFormatAndType} from "@core/constants/attestations-per-format";
import {MAT_DIALOG_DATA, MatDialogModule, MatDialogRef} from "@angular/material/dialog";
import {CommonModule} from "@angular/common";
import {MatButtonModule} from "@angular/material/button";
import {DialogData} from "@features/presentation-request-preparation/components/selectable-attestation-attributes/model/DialogData";
import {PresentationDefinitionService} from "@core/services/presentation-definition-service";
import {SdJwtVcAttestation} from "@core/models/attestation/Attestations";

@Component({
  standalone: true,
  selector: 'vc-selectable-attestation-attributes',
  templateUrl: './selectable-attestation-attributes.component.html',
  styleUrls: ['./selectable-attestation-attributes.component.scss'],
  imports: [
    CommonModule,
    MatCheckboxModule,
    MatExpansionModule,
    SharedModule,
    MatDialogModule,
    MatButtonModule
  ]
})
export class SelectableAttestationAttributesComponent implements OnInit {

  readonly data = inject<DialogData>(MAT_DIALOG_DATA);

  attestationType!: AttestationType;
  attestationFormat!: AttestationFormat;
  seed: InputDescriptor | undefined;

  formFields!: FormSelectableField[];
  draftInputDescriptor!: InputDescriptor;
  inputDescriptorText!: string;
  selectedFields: FieldConstraint[] = [];

  constructor(
    private readonly presentationDefinitionService: PresentationDefinitionService,
    private dialogRef: MatDialogRef<InputDescriptor>
  ) {
  }

  ngOnInit(): void {
    this.attestationFormat = this.data.format;
    this.attestationType = this.data.type;
    this.seed = this.data.seed;
    this.formFields = this.extractFormFieldsFromModel()
    if (this.seed) {
      this.selectedFields = this.seed.constraints.fields
      this.draftInputDescriptor = this.seed
    } else {
      this.initEmptyInputDescriptor();
    }
    this.inputDescriptorText = this.convertJSONtoString(this.draftInputDescriptor);
  }

  initEmptyInputDescriptor() {
    let inputDescriptorMaybe = this.presentationDefinitionService.inputDescriptorOf(
      this.attestationType,
      this.attestationFormat,
      ""
    );
    if (inputDescriptorMaybe) {
      this.draftInputDescriptor = inputDescriptorMaybe
    } else {
      console.log("Could not initialize InputDescriptor");
    }
  }

  handle(data: FormSelectableField) {
    const value = data.value;
    if (!this.exists(value.path[0])) {
      this.selectedFields.push(value);

    } else if (this.exists(value.path[0])) {
      this.selectedFields = this.selectedFields.filter((item: FieldConstraint) => {
        return String(item.path) !== String(value.path[0]);
      });
    }
    // Update draft presentation with selected fields
    this.draftInputDescriptor.constraints.fields = this.handleSdJwtVcVCTAttribute(this.selectedFields);
    // refresh descriptor text from model
    this.inputDescriptorText = this.convertJSONtoString(this.draftInputDescriptor);
  }

  private handleSdJwtVcVCTAttribute(constraints: FieldConstraint[]): FieldConstraint[] {
    if (this.attestationFormat !== AttestationFormat.SD_JWT_VC) {
      return constraints
    }
    let attestation = getAttestationByFormatAndType(this.attestationType, this.attestationFormat) as SdJwtVcAttestation;
    let vctIncluded = constraints.filter((item: FieldConstraint) => {
      item.path.includes("$.vct")
    }).length > 0;
    if (!vctIncluded) {
      return [this.presentationDefinitionService.sdJwtVCVctFieldConstraint(attestation), ...constraints]
    } else {
      return constraints
    }
  }

  convertJSONtoString(obj: object) {
    return JSON.stringify(obj, null, '\t');
  }

  exists(path: string) {
    const exists = this.selectedFields.filter((item) => item.path.includes(path));
    return exists.length > 0;
  }

  extractFormFieldsFromModel(): FormSelectableField[] {
    let attestation = getAttestationByFormatAndType(this.attestationType, this.attestationFormat);
    if (!attestation) {
      return []
    }
    return attestation.attestationDef.dataSet.map((attr, index) => {
      return {
        id: index,
        label: attr.attribute,
        value: this.presentationDefinitionService.fieldConstraint(attestation!.attributePath(attr)),
        visible: true
      }
    })
  }

  trackByFn(_index: number, data: FormSelectableField) {
    return data.id;
  }

  saveSelection() {
    this.dialogRef.close({
      data: {
        attestationType: this.attestationType,
        inputDescriptor: this.selectedFields.length == 0 ? null : this.draftInputDescriptor
      }
    });
  }

  isChecked(field: FormSelectableField) {
    return this.selectedFields.filter((item: FieldConstraint) => {
      return this.areEqualConstraints(item, field.value);
    }).length > 0
  }

  isSomethingSelected(): boolean {
    return this.selectedFields.length > 0;
  }

  areEqualConstraints(one: FieldConstraint, other: FieldConstraint): boolean {
    function pathsAreEqual(a: string[], b: string[]): boolean {
      if (a === b) return true;
      if (a == null || b == null) return false;
      if (a.length !== b.length) return false;

      return JSON.stringify(a) == JSON.stringify(b);
    }

    function filtersAreEqual(a: Filter | undefined, b: Filter | undefined): boolean {
      if (a === b) return true;
      if (a == null || b == null) return false;

      return a.type == b.type && JSON.stringify(a.contains) == JSON.stringify(b.contains);
    }

    return one.intent_to_retain === other.intent_to_retain &&
      pathsAreEqual(one.path, other.path) &&
      filtersAreEqual(one.filter, other.filter)
  }

}
