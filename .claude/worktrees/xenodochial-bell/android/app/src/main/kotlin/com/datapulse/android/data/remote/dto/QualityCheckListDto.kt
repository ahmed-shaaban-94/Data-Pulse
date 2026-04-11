package com.datapulse.android.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class QualityCheckListDto(
    val checks: List<QualityCheckDto> = emptyList(),
    val passed: Boolean = true,
)
