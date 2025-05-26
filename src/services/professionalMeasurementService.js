const logger = require('../utils/logger');

class ProfessionalMeasurementService {
  constructor() {
    this.complexityIndicators = {
      size: ['bay window', 'bow window', 'corner window', 'curved', 'arched', 'irregular', 'custom shape'],
      type: ['skylight', 'clerestory', 'transom', 'sidelight', 'glass block', 'custom'],
      measurement: ['exact fit', 'tight space', 'high location', 'structural', 'load bearing'],
      specification: ['multiple angles', 'compound curves', 'non-standard', 'historic', 'conservation']
    };

    this.measurementGuidelines = {
      standard: {
        tools: ['tape measure', 'level', 'pencil and paper'],
        accuracy: '1/8 inch tolerance',
        tips: [
          'Measure width at top, middle, and bottom - use smallest measurement',
          'Measure height at left, middle, and right - use smallest measurement',
          'Check if window opening is square by measuring diagonals',
          'Account for any trim or molding that will remain'
        ]
      },
      professional: {
        reasons: [
          'Complex window shapes require precise angle measurements',
          'Structural considerations need professional assessment',
          'Historic windows may have special preservation requirements',
          'Multi-story or hard-to-reach windows need safety equipment'
        ],
        benefits: [
          'Guaranteed accurate measurements',
          'Identification of structural issues',
          'Professional liability coverage',
          'Compliance with building codes'
        ]
      }
    };
  }

  assessMeasurementComplexity(windowSpecs, userContext = {}) {
    const complexityFactors = [];
    let complexityScore = 0;

    // Check for size complexity
    if (windowSpecs.additionalDetails) {
      const details = windowSpecs.additionalDetails.toLowerCase();
      for (const indicator of this.complexityIndicators.size) {
        if (details.includes(indicator)) {
          complexityFactors.push(`Complex window shape: ${indicator}`);
          complexityScore += 3;
        }
      }
    }

    // Check for type complexity
    if (windowSpecs.type) {
      const type = windowSpecs.type.toLowerCase();
      for (const indicator of this.complexityIndicators.type) {
        if (type.includes(indicator)) {
          complexityFactors.push(`Specialized window type: ${indicator}`);
          complexityScore += 2;
        }
      }
    }

    // Check for measurement challenges
    if (windowSpecs.location) {
      const location = windowSpecs.location.toLowerCase();
      if (location.includes('floor') && parseInt(location) > 2) {
        complexityFactors.push('High location requires special equipment');
        complexityScore += 2;
      }
    }

    // Check user experience level
    if (userContext.measurementExperience === 'none' || userContext.previousErrors) {
      complexityFactors.push('Limited measurement experience');
      complexityScore += 1;
    }

    return {
      score: complexityScore,
      factors: complexityFactors,
      recommendsProfessional: complexityScore >= 3,
      reasoning: this.generateRecommendationReasoning(complexityFactors, complexityScore)
    };
  }

  generateRecommendationReasoning(factors, score) {
    if (score >= 5) {
      return 'Professional measurement strongly recommended due to multiple complexity factors';
    } else if (score >= 3) {
      return 'Professional measurement recommended for accuracy and safety';
    } else if (score >= 1) {
      return 'DIY measurement possible with careful attention to guidelines';
    }
    return 'Standard DIY measurement should be sufficient';
  }

  generateMeasurementGuidance(windowSpecs, assessmentResult) {
    const guidance = {
      recommendsProfessional: assessmentResult.recommendsProfessional,
      reasoning: assessmentResult.reasoning,
      complexityFactors: assessmentResult.factors
    };

    if (assessmentResult.recommendsProfessional) {
      guidance.professionalBenefits = this.measurementGuidelines.professional.benefits;
      guidance.whyProfessional = this.selectRelevantReasons(
        assessmentResult.factors,
        this.measurementGuidelines.professional.reasons
      );
      guidance.nextSteps = [
        'We can connect you with certified window measurement professionals',
        'Professional measurement typically costs $50-150 but ensures accuracy',
        'Measurements usually completed within 2-3 business days'
      ];
    } else {
      guidance.diyGuidance = {
        tools: this.measurementGuidelines.standard.tools,
        accuracy: this.measurementGuidelines.standard.accuracy,
        tips: this.selectRelevantTips(windowSpecs, this.measurementGuidelines.standard.tips),
        videoTutorial: 'We can send you a link to our measurement guide video'
      };
      guidance.validationOffer = 'Send us photos of your measurements for free validation';
    }

    guidance.alternativeOptions = this.generateAlternativeOptions(windowSpecs, assessmentResult);

    return guidance;
  }

  selectRelevantReasons(factors, allReasons) {
    const relevant = [];
    
    for (const reason of allReasons) {
      for (const factor of factors) {
        if (reason.toLowerCase().includes(factor.split(':')[0].toLowerCase())) {
          relevant.push(reason);
          break;
        }
      }
    }

    return relevant.length > 0 ? relevant : allReasons.slice(0, 2);
  }

  selectRelevantTips(windowSpecs, allTips) {
    // Always include basic measurement tips
    const tips = [...allTips];

    // Add specific tips based on window type
    if (windowSpecs.type === 'Double Hung') {
      tips.push('For double hung windows, measure both sashes if replacing separately');
    } else if (windowSpecs.type === 'Casement') {
      tips.push('For casement windows, note the hinge side (left or right)');
    } else if (windowSpecs.type === 'Sliding') {
      tips.push('For sliding windows, measure the track depth as well');
    }

    return tips;
  }

  generateAlternativeOptions(windowSpecs, assessmentResult) {
    const alternatives = [];

    if (assessmentResult.recommendsProfessional) {
      alternatives.push({
        option: 'Schedule Professional Measurement',
        description: 'We can arrange for a certified professional to measure your windows',
        action: 'schedule_professional'
      });

      alternatives.push({
        option: 'Rough Estimate',
        description: 'Provide rough dimensions for a ballpark quote (final price may vary)',
        action: 'rough_estimate'
      });

      alternatives.push({
        option: 'Photo Assessment',
        description: 'Send photos for our experts to provide measurement guidance',
        action: 'photo_assessment'
      });
    } else {
      alternatives.push({
        option: 'DIY with Validation',
        description: 'Measure yourself and send photos for our free validation service',
        action: 'diy_validated'
      });

      alternatives.push({
        option: 'Video Guidance',
        description: 'Receive our step-by-step video measurement guide',
        action: 'video_guide'
      });
    }

    alternatives.push({
      option: 'Defer Measurement',
      description: 'Save your quote request and come back when you have measurements',
      action: 'defer_measurement'
    });

    return alternatives;
  }

  async validateUserMeasurements(measurements, windowSpecs) {
    const validation = {
      valid: true,
      warnings: [],
      errors: []
    };

    // Check measurement reasonableness
    if (measurements.width) {
      if (measurements.width < 12) {
        validation.warnings.push('Width seems unusually small - please verify');
      } else if (measurements.width > 120) {
        validation.warnings.push('Width seems unusually large - please verify');
      }
    }

    if (measurements.height) {
      if (measurements.height < 12) {
        validation.warnings.push('Height seems unusually small - please verify');
      } else if (measurements.height > 120) {
        validation.warnings.push('Height seems unusually large - please verify');
      }
    }

    // Check measurement consistency
    if (measurements.topWidth && measurements.bottomWidth) {
      const diff = Math.abs(measurements.topWidth - measurements.bottomWidth);
      if (diff > 0.5) {
        validation.warnings.push(`Opening appears to be out of square by ${diff} inches`);
      }
    }

    // Validate against window type constraints
    if (windowSpecs.type === 'Picture' && measurements.operableWidth) {
      validation.errors.push('Picture windows should not have operable dimensions');
      validation.valid = false;
    }

    return validation;
  }

  generateProfessionalReferral(userLocation, windowSpecs) {
    // This would integrate with a professional network in production
    return {
      available: true,
      estimatedCost: '$75-125',
      timeframe: '2-3 business days',
      coverage: 'Professional liability insurance included',
      guarantee: 'Measurement accuracy guaranteed',
      booking: 'Reply "BOOK PROFESSIONAL" to schedule'
    };
  }
}

module.exports = ProfessionalMeasurementService;