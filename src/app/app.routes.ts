import { Routes } from '@angular/router';
import { PrayersListComponent } from './pages/prayers-list/prayers-list.component';
import { PrayerDetailComponent } from './pages/prayer-details/prayer-details.component';
import { PrayerTypesListComponent } from './pages/prayer-types-list/prayer-types-list.component';
import { AuthGuard } from './core/guards/auth.guard';
import { LoginComponent } from './pages/login/login.component';

export const routes: Routes = [
  { path: '', redirectTo: 'prayers', pathMatch: 'full' },
  { path: 'prayers', component: PrayersListComponent, canActivate: [AuthGuard] },
  { path: 'prayers/:id', component: PrayerDetailComponent, canActivate: [AuthGuard] },
  { path: 'prayerTypes', component: PrayerTypesListComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent},
];
