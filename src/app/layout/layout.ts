import { Component } from '@angular/core';
import { NavbarComponent } from "../navbar/navbar.component.ts/navbar.component";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: 'app-layout',
  imports: [NavbarComponent, RouterOutlet],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {

}
