import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PlaylistSwitcherComponent } from 'components';
import { XtreamCategory } from 'shared-interfaces';
import {
    CategoryManagementDialogComponent,
    CategoryManagementDialogData,
} from './category-management-dialog/category-management-dialog.component';
import { CategoryViewComponent } from './category-view/category-view.component';
import { XtreamStore } from './stores/xtream.store';

@Component({
    selector: 'app-xtream-main-container',
    templateUrl: './xtream-main-container.component.html',
    styleUrls: ['./xtream-main-container.component.scss', './sidebar.scss'],
    imports: [
        CategoryViewComponent,
        FormsModule,
        MatFormFieldModule,
        MatIcon,
        MatIconButton,
        MatInputModule,
        MatSlideToggleModule,
        MatTooltipModule,
        PlaylistSwitcherComponent,
        RouterOutlet,
        TranslateModule,
    ],
})
export class XtreamMainContainerComponent implements OnInit {
    readonly router = inject(Router);
    readonly route = inject(ActivatedRoute);
    readonly translateService = inject(TranslateService);
    readonly xtreamStore = inject(XtreamStore);
    private readonly dialog = inject(MatDialog);

    readonly categories = this.xtreamStore.getCategoriesBySelectedType;
    readonly categoryFilterEnabled = this.xtreamStore.categoryFilterEnabled;
    readonly categoryItemCounts = this.xtreamStore.getCategoryItemCounts;
    readonly currentPlaylist = this.xtreamStore.currentPlaylist;
    readonly selectedCategoryId = this.xtreamStore.selectedCategoryId;

    // Category search
    readonly categorySearchTerm = signal('');
    readonly filteredCategories = computed(() => {
        const categories = this.categories();
        const searchTerm = this.categorySearchTerm().toLowerCase().trim();
        if (!searchTerm) {
            return categories;
        }
        return categories.filter((cat: any) =>
            (cat.name || cat.category_name || '').toLowerCase().includes(searchTerm)
        );
    });

    ngOnInit(): void {
        const { categoryId } = this.route.snapshot.params;
        if (categoryId)
            this.xtreamStore.setSelectedCategory(Number(categoryId));
    }

    categoryClicked(category: XtreamCategory) {
        const categoryId = (category as any).category_id ?? category.id;

        // Clear any selected item when switching categories
        this.xtreamStore.setSelectedItem(null);

        this.xtreamStore.setSelectedCategory(Number(categoryId));

        this.router.navigate([categoryId], {
            relativeTo: this.route,
        });
    }

    getContentLabel(): string {
        const selectedCategoryId = this.xtreamStore.selectedCategoryId();

        // When no category is selected, show "Recently Added"
        if (selectedCategoryId === null || selectedCategoryId === undefined) {
            const recentlyAddedLabel = this.translateService.instant('PORTALS.SIDEBAR.RECENTLY_ADDED');

            // Show page number when viewing recently added (not detail view)
            if (
                !this.xtreamStore.selectedItem() &&
                this.xtreamStore.getTotalPages() > 1
            ) {
                const currentPage = this.xtreamStore.page() + 1;
                const totalPages = this.xtreamStore.getTotalPages();
                const pageLabel = this.translateService.instant('PORTALS.PAGE');
                return `${recentlyAddedLabel} (${pageLabel} ${currentPage}/${totalPages})`;
            }

            return recentlyAddedLabel;
        }

        const selectedCategory = this.xtreamStore.getSelectedCategory();
        const categoryName = selectedCategory
            ? (selectedCategory as any).name
            : 'Category Content';

        // Show page number when viewing category content (not detail view)
        if (
            !this.xtreamStore.selectedItem() &&
            this.xtreamStore.getTotalPages() > 1
        ) {
            const currentPage = this.xtreamStore.page() + 1; // +1 because page is 0-indexed
            const totalPages = this.xtreamStore.getTotalPages();
            const pageLabel = this.translateService.instant('PORTALS.PAGE');
            return `${categoryName} (${pageLabel} ${currentPage}/${totalPages})`;
        }

        return categoryName;
    }

    historyBack() {
        this.router.navigate(['.', this.xtreamStore.selectedCategoryId()], {
            relativeTo: this.route,
        });
    }

    openCategoryManagement(): void {
        // The playlist id is in the parent route (xtreams/:id)
        const playlistId = this.route.parent?.snapshot.params['id'];
        const contentType = this.xtreamStore.selectedContentType();

        const dialogRef = this.dialog.open<
            CategoryManagementDialogComponent,
            CategoryManagementDialogData,
            boolean
        >(CategoryManagementDialogComponent, {
            data: {
                playlistId,
                contentType,
                itemCounts: this.categoryItemCounts(),
            },
            width: '500px',
            maxHeight: '80vh',
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                // Reload categories from database to reflect visibility changes
                this.xtreamStore.reloadCategories();
            }
        });
    }

    async onCategoryFilterToggle(enabled: boolean): Promise<void> {
        this.xtreamStore.setCategoryFilterEnabled(enabled);
        if (!enabled) {
            // Load all categories when filter is disabled
            await this.xtreamStore.fetchAllCategoriesUnfiltered();
        }
    }
}
