import { NgForm } from "@angular/forms";
import { RegularInterventionModalComponent } from "../pages/regular/regular-intervention-modal.component";
import { InterventionModalComponent } from "../pages/exceptional-common/intervention-modal.component";

describe("Required intervention ticket", () => {
  it.each(["regular", "exceptional"])("rejects empty %s tickets and trims saved references", family => {
    const modal = family === "regular" ? new RegularInterventionModalComponent() : new InterventionModalComponent();
    const saved = jest.spyOn(modal.saved, "emit");
    const validForm = { invalid: false } as NgForm;
    modal.form.ticket = "";
    modal.save(validForm);
    modal.form.ticket = "   ";
    modal.save(validForm);
    expect(saved).not.toHaveBeenCalled();
    modal.form.ticket = " INC-123 ";
    modal.save(validForm);
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ ticket: "INC-123" }));
    saved.mockClear();
    modal.save({ invalid: true } as NgForm);
    expect(saved).not.toHaveBeenCalled();
  });
});
