package com.datapulse.android.presentation.navigation

import kotlinx.serialization.Serializable

sealed interface NavRoute {
    @Serializable data object Login : NavRoute
    @Serializable data object Dashboard : NavRoute
    @Serializable data object Products : NavRoute
    @Serializable data object Customers : NavRoute
    @Serializable data object Staff : NavRoute
    @Serializable data object Sites : NavRoute
    @Serializable data object Returns : NavRoute
    @Serializable data object Pipeline : NavRoute
}
