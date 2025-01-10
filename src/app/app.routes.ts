import { Routes } from '@angular/router';
import { PrayersListComponent } from './pages/prayers-list/prayers-list.component';
import { PrayerDetailComponent } from './pages/prayer-details/prayer-details.component';
import { PrayerTypesListComponent } from './pages/prayer-types-list/prayer-types-list.component';
import { AuthGuard } from './core/guards/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { LiturgicalTextDetailComponent } from './pages/liturgical-text-detail/liturgical-text-detail.component';
import { LiturgicalTextsListComponent } from './pages/liturgical-texts-list/liturgical-texts-list.component';
import { SectionsListComponent } from './pages/sections-list/sections-list.component';
import { SectionDetailsComponent } from './pages/section-details/section-details.component';

export const routes: Routes = [
  { path: '', redirectTo: 'prayers', pathMatch: 'full' },
  { path: 'prayers', component: PrayersListComponent, canActivate: [AuthGuard] },
  { path: 'prayers/:id', component: PrayerDetailComponent, canActivate: [AuthGuard] },
  { path: 'prayerTypes', component: PrayerTypesListComponent, canActivate: [AuthGuard] },
  { path: 'liturgicalTexts', component: LiturgicalTextsListComponent, canActivate: [AuthGuard] },
  { path: 'liturgicalTexts/:id/:sectionStartTime', component: LiturgicalTextDetailComponent, canActivate: [AuthGuard] },
  { path: 'liturgicalTexts/:id', component: LiturgicalTextDetailComponent, canActivate: [AuthGuard] },
  { path: 'sections', component: SectionsListComponent, canActivate: [AuthGuard] },
  { path: 'sections/:id', component: SectionDetailsComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent},
];
