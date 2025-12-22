import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NavbarComponentTs } from './navbar.component.ts';

describe('NavbarComponentTs', () => {
  let component: NavbarComponentTs;
  let fixture: ComponentFixture<NavbarComponentTs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponentTs]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NavbarComponentTs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
